export function PlugIcon() {
  return (
    <svg className="icon-plug" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="60" fill="currentColor" />
      <path
        d="M87.907 40.4602V34.8886H78.1617V32.093H73.2595C67.6683 32.093 63.0023 35.9518 61.762 41.1689H44.9292C37.8418 41.1689 32.093 46.9177 32.093 54.0052V60.4233C32.093 67.4911 37.8418 73.2595 44.9292 73.2595H62.5102C66.5067 73.2595 69.7748 76.5079 69.7748 80.5242V87.9267H75.3464V80.5242C75.3464 73.4367 69.5976 67.688 62.5102 67.688H44.9292C40.9327 67.688 37.6646 64.4395 37.6646 60.4233V54.0052C37.6646 50.0086 40.913 46.7405 44.9292 46.7405H61.762C63.0023 51.938 67.688 55.8164 73.2595 55.8164H78.1617V53.0208H87.8873V47.4492H78.1617V40.4602H87.907Z"
        fill="white"
      />
    </svg>
  );
}

// Footer links: website (globe) and LinkedIn.
export function WebIcon() {
  return (
    <svg className="icon-social" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9S14.6 18.4 12 21c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
      </g>
    </svg>
  );
}

export function LinkedInIcon() {
  return (
    <svg className="icon-social" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"
      />
    </svg>
  );
}

// Own simple icon.

export function CheckIcon() {
  return (
    <svg className="icon-check" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
