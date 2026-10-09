/**
 * One offer as a card: title, price, place, fine print, and the two links the API hands back.
 *
 * The search answer is a summary. The place and the fine print live on the full offer, so each
 * card reads it once (`GET /ls_offers/agent_offers/{permalink}`) and shows what it finds.
 */

import { useEffect, useState } from "react";
import type { OfferDetail, OfferLocation, OfferSummary, Price } from "./api";
import { livingSocial } from "./api";
import { CardArt } from "./CardArt";

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly detail: OfferDetail }
  | { readonly status: "failed" };

function useOfferDetail(permalink: string): DetailState {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    livingSocial.offerDetail(permalink).then(
      (detail) => {
        if (!cancelled) setState({ status: "ready", detail });
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [permalink]);

  return state;
}

/** Money comes in minor units: 1998 with exponent 2 is 19.98. */
function formatMinor(minor: number, price: Price): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: price.currencyExponent,
    maximumFractionDigits: price.currencyExponent,
  }).format(minor / 10 ** price.currencyExponent);
}

function priceLabel(price: Price): string {
  const from = formatMinor(price.fromMinor, price);
  return price.fromMinor === price.toMinor ? from : `${from} to ${formatMinor(price.toMinor, price)}`;
}

/** Street data arrives with stray trailing commas ("66 Long Wharf,"); trim them for display. */
function tidy(text: string | null): string | null {
  const trimmed = text?.replace(/[,\s]+$/, "").trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

interface Place {
  readonly label: string;
  readonly moreInCity: number;
}

/** The first location in the city that was searched, and how many more the offer has there. */
function placeOf(locations: readonly OfferLocation[], city: string): Place | null {
  const inCity = locations.filter((location) => location.city?.toLowerCase() === city.toLowerCase());
  const first = inCity[0];
  if (first === undefined) return null;
  const label = [tidy(first.name), tidy(first.street)].filter((part): part is string => part !== null).join(", ");
  return label === "" ? null : { label, moreInCity: inCity.length - 1 };
}

/** Links come from a remote API: only a web address becomes a link. */
function webUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

interface OfferCardProps {
  readonly offer: OfferSummary;
  /** The city that was searched; the card shows the offer's location in it. */
  readonly city: string;
}

/** The offer's own photo when it has one that loads; else the site's drawing for its kind of evening. */
function CardPicture({ offer }: { readonly offer: OfferSummary }) {
  const photoUrl = webUrl(offer.primaryImageUrl);
  const [failed, setFailed] = useState(false);
  if (photoUrl === null || failed) return <CardArt category={offer.category} />;
  return (
    <div className="card-photo">
      <img src={photoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  );
}

export function OfferCard({ offer, city }: OfferCardProps) {
  const detail = useOfferDetail(offer.permalink);
  const buyUrl = webUrl(offer.buyUrl);
  const offerUrl = webUrl(offer.offerUrl);

  return (
    <li className="card">
      <CardPicture offer={offer} />
      <p className="card-category">{[offer.category, offer.city].filter(Boolean).join(" · ")}</p>
      <h3 className="card-title">{offer.title}</h3>
      {offer.summary !== null && <p className="card-summary">{offer.summary}</p>}

      {offer.price !== null && (
        <p className="card-price">
          <span className="card-price-amount">{priceLabel(offer.price)}</span>
          {offer.price.fromMinor !== offer.price.toMinor && <span className="card-price-note"> depending on the option</span>}
        </p>
      )}

      <PlaceLine state={detail} city={city} />
      <FinePrint state={detail} />

      <div className="card-actions">
        {buyUrl !== null ? (
          <a className="button button-primary" href={buyUrl} target="_blank" rel="noopener noreferrer">
            Buy on Groupon
          </a>
        ) : (
          <span className="button button-disabled" aria-disabled="true">
            Not for sale right now
          </span>
        )}
        {offerUrl !== null && (
          <a className="button button-secondary" href={offerUrl} target="_blank" rel="noopener noreferrer">
            Offer page
          </a>
        )}
      </div>
    </li>
  );
}

function PlaceLine({ state, city }: { readonly state: DetailState; readonly city: string }) {
  switch (state.status) {
    case "loading":
      return <p className="card-place card-muted">Finding the place…</p>;
    case "failed":
      return <p className="card-place card-muted">{city}. The street did not load; the offer page has it.</p>;
    case "ready": {
      const place = placeOf(state.detail.locations, city);
      if (place === null) return <p className="card-place card-muted">{city}. No street is listed for this offer.</p>;
      return (
        <p className="card-place">
          {place.label}
          {place.moreInCity > 0 && <span className="card-muted"> and {place.moreInCity} more in {city}</span>}
        </p>
      );
    }
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

function FinePrint({ state }: { readonly state: DetailState }) {
  switch (state.status) {
    case "loading":
      return <p className="card-fineprint card-muted">Loading the fine print…</p>;
    case "failed":
      return <p className="card-fineprint card-muted">The fine print did not load. Read it on the offer page before you buy.</p>;
    case "ready": {
      const lines = state.detail.finePrint;
      if (lines.length === 0) {
        return <p className="card-fineprint card-muted">No fine print is listed. Check the offer page before you buy.</p>;
      }
      return (
        <details className="card-fineprint">
          <summary>Fine print ({lines.length})</summary>
          <ul>
            {lines.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        </details>
      );
    }
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}
