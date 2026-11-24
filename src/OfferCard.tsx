/**
 * One product as a card: photo, title, price, place, fine print, and the way to buy it.
 *
 * The search answer already carries each product in full, so the card reads nothing more. Buying
 * is a form that posts to the site's own function (`/api/buy`) in a new tab: the function makes a
 * cart under the storefront's key and sends the tab on to the cart's `buyLink`, Groupon's
 * checkout with the storefront's logo.
 */

import { useState } from "react";
import { BUY_ACTION, type Place, type Price, type ProductCard } from "./api";
import { CardArt } from "./CardArt";

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

interface PlaceLabel {
  readonly label: string;
  readonly moreInCity: number;
}

/** The first location in the city that was searched, and how many more the product has there. */
function placeOf(locations: readonly Place[], city: string): PlaceLabel | null {
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
  readonly product: ProductCard;
  /** The city that was searched; the card shows the product's location in it. */
  readonly city: string;
}

/** The product's own photo when it has one that loads; else the site's drawing for its kind of evening. */
function CardPicture({ product }: { readonly product: ProductCard }) {
  const photoUrl = webUrl(product.imageUrl);
  const [failed, setFailed] = useState(false);
  if (photoUrl === null || failed) return <CardArt category={product.category} />;
  return (
    <div className="card-photo">
      <img src={photoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  );
}

export function OfferCard({ product, city }: OfferCardProps) {
  const bookingUrl = webUrl(product.bookingUrl);
  const bookingOptions = product.bookingOptions.filter((option) => webUrl(option.bookingUrl) !== null);
  const place = placeOf(product.locations, city);

  return (
    <li className="card">
      <CardPicture key={product.imageUrl} product={product} />
      <p className="card-category">{[product.category, city].filter(Boolean).join(" · ")}</p>
      <h3 className="card-title">{product.title}</h3>
      {product.summary !== null && <p className="card-summary">{product.summary}</p>}

      {product.price !== null && (
        <p className="card-price">
          <span className="card-price-amount">{priceLabel(product.price)}</span>
          {product.price.fromMinor !== product.price.toMinor && <span className="card-price-note"> depending on the option</span>}
        </p>
      )}

      {place === null ? (
        <p className="card-place card-muted">{city}. No street is listed for this offer.</p>
      ) : (
        <p className="card-place">
          {place.label}
          {place.moreInCity > 0 && <span className="card-muted"> and {place.moreInCity} more in {city}</span>}
        </p>
      )}
      <FinePrint lines={product.finePrint} />

      {bookingUrl !== null || bookingOptions.length > 0 ? (
        <p className="card-booking-note">Choose your date and time on Groupon before paying.</p>
      ) : product.buyOptionId !== null ? (
        <p className="card-booking-note">You pay on Groupon.</p>
      ) : null}
      {bookingUrl === null && bookingOptions.length > 0 && (
        <details className="card-booking-options">
          <summary>Choose a booking option</summary>
          <ul>
            {bookingOptions.map((option) => (
              <li key={option.id}>
                <a href={option.bookingUrl} target="_blank" rel="noopener noreferrer">{option.title}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="card-actions">
        {product.buyOptionId !== null ? (
          // A form, not a link: each press makes one cart, and a link could be prefetched.
          <form method="post" action={BUY_ACTION} target="_blank">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="optionId" value={product.buyOptionId} />
            <button type="submit" className="button button-primary">
              Buy on Groupon
            </button>
          </form>
        ) : bookingUrl !== null ? (
          <a className="button button-primary" href={bookingUrl} target="_blank" rel="noopener noreferrer">
            Choose dates & book
          </a>
        ) : bookingOptions.length === 0 ? (
          <span className="card-muted" role="status">Not for sale right now</span>
        ) : null}
      </div>
    </li>
  );
}

function FinePrint({ lines }: { readonly lines: readonly string[] | null }) {
  if (lines === null || lines.length === 0) {
    return <p className="card-fineprint card-muted">No fine print is listed. Read it on Groupon&rsquo;s checkout before you pay.</p>;
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
