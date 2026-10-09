/**
 * The site's mark: a crescent moon holding a small heart, and the wordmark beside it.
 *
 * Drawn here, not loaded: the page has no image the API did not send, and the mark is the site's own.
 */

export function LogoMark({ size = 40 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#ff9f43" />
        </linearGradient>
        <mask id="logo-crescent">
          <rect width="40" height="40" fill="#fff" />
          <circle cx="26" cy="15" r="13" fill="#000" />
        </mask>
      </defs>
      <circle cx="18" cy="21" r="15" fill="url(#logo-moon)" mask="url(#logo-crescent)" />
      <path
        d="M27.5 27.4c-2.6-1.9-4.6-3.6-4.6-5.8 0-1.5 1.1-2.6 2.5-2.6.9 0 1.7.5 2.1 1.2.4-.7 1.2-1.2 2.1-1.2 1.4 0 2.5 1.1 2.5 2.6 0 2.2-2 3.9-4.6 5.8z"
        fill="#ff4d8d"
      />
      <circle cx="33" cy="9" r="1.2" fill="#fff6e0" />
      <circle cx="29" cy="5" r="0.7" fill="#fff6e0" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-words">
        <span className="logo-name">Date night</span>
        <span className="logo-place">in Austin</span>
      </span>
    </span>
  );
}
