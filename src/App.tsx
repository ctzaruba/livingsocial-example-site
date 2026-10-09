/**
 * "Date night in Austin": one page that searches live LivingSocial offers by city and words.
 *
 * The search runs when the city changes or the form is submitted, never on each keystroke: the
 * API allows 60 searches a minute from one address.
 */

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, livingSocial, type OfferSummary } from "./api";
import { CITIES, type City, DEFAULT_QUERY, PAGE_SIZE, SOURCE_URL } from "./config";
import { Logo } from "./Logo";
import { OfferCard } from "./OfferCard";
import { Skyline } from "./Skyline";

type MoreState = "idle" | "loading" | "failed";

type ResultsView =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string; readonly retryAfterSeconds: number | null }
  | {
      readonly status: "ready";
      /** Which search these offers belong to, so a late "show more" cannot land on a newer one. */
      readonly searchKey: string;
      readonly offers: readonly OfferSummary[];
      readonly total: number;
      readonly next: string | null;
      readonly asOf: string;
      readonly more: MoreState;
    };

function describeError(error: unknown): ResultsView {
  if (error instanceof ApiError && error.retryAfterSeconds !== null) {
    return {
      status: "error",
      message: "LivingSocial asks for a short pause: this connection has searched a lot in the last minute.",
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error instanceof ApiError && error.status === 400) {
    return { status: "error", message: "That search could not be run. Try different words.", retryAfterSeconds: null };
  }
  return { status: "error", message: "Offers could not be loaded just now.", retryAfterSeconds: null };
}

function formatAsOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function App() {
  const [city, setCity] = useState<City>("Austin");
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ResultsView>({ status: "loading" });

  const searchKey = `${city}|${query}|${attempt}`;
  // Between a change of city or words and the effect that starts the new search, the old offers
  // would show under the new heading for a frame; they are shown only for the search they answer.
  const shown: ResultsView = view.status === "ready" && view.searchKey !== searchKey ? { status: "loading" } : view;

  useEffect(() => {
    const controller = new AbortController();
    setView({ status: "loading" });
    livingSocial.search({ city, q: query, limit: PAGE_SIZE }, controller.signal).then(
      (result) =>
        setView({
          status: "ready",
          searchKey,
          offers: result.offers,
          total: result.total,
          next: result.next,
          asOf: result.asOf,
          more: "idle",
        }),
      (error: unknown) => {
        if (!controller.signal.aborted) setView(describeError(error));
      }
    );
    return () => controller.abort();
  }, [city, query, attempt, searchKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = draft.trim();
    const next = words === "" ? DEFAULT_QUERY : words;
    setDraft(next);
    // The same words again is a retry, not a no-op.
    if (next === query) setAttempt((count) => count + 1);
    else setQuery(next);
  }

  function handleShowMore() {
    if (view.status !== "ready" || view.next === null || view.more === "loading") return;
    const cursor = view.next;
    const startedFor = view.searchKey;
    setView({ ...view, more: "loading" });
    livingSocial.search({ city, q: query, limit: PAGE_SIZE, cursor }).then(
      (page) =>
        setView((current) =>
          current.status === "ready" && current.searchKey === startedFor
            ? { ...current, offers: [...current.offers, ...page.offers], next: page.next, total: page.total, more: "idle" }
            : current
        ),
      () =>
        setView((current) =>
          current.status === "ready" && current.searchKey === startedFor ? { ...current, more: "failed" } : current
        )
    );
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="topbar">
          <Logo />
          <a className="topbar-link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </div>

        <div className="hero">
          <div className="hero-text">
            <p className="eyebrow">An example on the LivingSocial agent API</p>
            <h1>
              Date night <em>in {city}</em>
            </h1>
            <p className="lede">
              Live LivingSocial offers for {city}, matching “{query}”. Pick a city, change the words, and buy on Groupon.
            </p>
          </div>
          <div className="hero-art">
            <Skyline />
          </div>
        </div>

        <form className="controls" onSubmit={handleSubmit}>
          <fieldset className="cities">
            <legend>City</legend>
            {CITIES.map((name) => (
              <label key={name} className="city">
                <input type="radio" name="city" value={name} checked={city === name} onChange={() => setCity(name)} />
                <span>{name}</span>
              </label>
            ))}
          </fieldset>

          <div className="search">
            <label htmlFor="words">Search words</label>
            <div className="search-row">
              <input
                id="words"
                type="search"
                value={draft}
                placeholder={DEFAULT_QUERY}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="button button-primary">
                Search
              </button>
            </div>
          </div>
        </form>
      </header>

      <main aria-busy={shown.status === "loading"}>
        <Results
          view={shown}
          city={city}
          onRetry={() => setAttempt((count) => count + 1)}
          onShowMore={handleShowMore}
        />
      </main>

      <footer className="footer">
        <p>
          Offers and prices come live from LivingSocial; you complete the purchase on Groupon&rsquo;s checkout, and a
          purchase doesn&rsquo;t reserve a date or time.
        </p>
        <p>
          The drawings are the site&rsquo;s own: the API sends no pictures of offers.{" "}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Read the source
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

interface ResultsProps {
  readonly view: ResultsView;
  readonly city: string;
  readonly onRetry: () => void;
  readonly onShowMore: () => void;
}

function Results({ view, city, onRetry, onShowMore }: ResultsProps) {
  switch (view.status) {
    case "loading":
      return (
        <p className="notice" role="status">
          Loading offers…
        </p>
      );
    case "error":
      return <ErrorNotice message={view.message} retryAfterSeconds={view.retryAfterSeconds} onRetry={onRetry} />;
    case "ready": {
      if (view.offers.length === 0) {
        return (
          <p className="notice">
            No offers match these words in {city} right now. Try one broader word, such as “dinner” or “class”, or
            another city.
          </p>
        );
      }
      return (
        <>
          <p className="count" role="status">
            Showing {view.offers.length} of {view.total} offers · ranked {formatAsOf(view.asOf)}
          </p>
          <ul className="grid">
            {view.offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} city={city} />
            ))}
          </ul>
          {view.next !== null && (
            <div className="more">
              <button type="button" className="button button-secondary" disabled={view.more === "loading"} onClick={onShowMore}>
                {view.more === "loading" ? "Loading…" : "Show more"}
              </button>
              {view.more === "failed" && <p className="notice-inline">More offers could not be loaded. Try again.</p>}
            </div>
          )}
        </>
      );
    }
    default: {
      const unreachable: never = view;
      return unreachable;
    }
  }
}

interface ErrorNoticeProps {
  readonly message: string;
  readonly retryAfterSeconds: number | null;
  readonly onRetry: () => void;
}

/** One plain sentence and a retry; after a 429 the retry waits out the seconds the API asked for. */
function ErrorNotice({ message, retryAfterSeconds, onRetry }: ErrorNoticeProps) {
  const [remaining, setRemaining] = useState(retryAfterSeconds ?? 0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  return (
    <div className="notice notice-error" role="alert">
      <p>{message}</p>
      <button type="button" className="button button-primary" disabled={remaining > 0} onClick={onRetry}>
        {remaining > 0 ? `Try again in ${remaining} s` : "Try again"}
      </button>
    </div>
  );
}
