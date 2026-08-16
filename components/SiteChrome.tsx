import Link from "next/link";

const CONTACT_EMAIL = "victoriaklimova@gmail.com";
const LINKEDIN = "https://www.linkedin.com/in/victoriaklimova/";
const REPO = "https://github.com/datavic/lead-user-discovery";

/**
 * The diffusion S-curve of adoption, bright at the early edge and fading into
 * the mainstream, with the lead user marked ahead of the mass — the idea the
 * whole tool is built on.
 */
function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logoCurve" x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      <path
        d="M6 25 C 12 25, 12 17, 16 16 C 20 15, 20 7, 26 7"
        fill="none"
        stroke="url(#logoCurve)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      <circle cx="9.5" cy="12" r="5.5" fill="var(--good)" opacity="0.18" />
      <circle cx="9.5" cy="12" r="2.9" fill="var(--good)" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <LogoMark />
          Lead User Discovery
        </Link>

        <nav className="site-nav">
          <Link href="/">Search</Link>
          <Link href="/about">About</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>
          Built by{" "}
          <a href={LINKEDIN} target="_blank" rel="noreferrer">
            Victoria Klimova
          </a>
        </span>
        <span className="footer-links">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a href={REPO} target="_blank" rel="noreferrer">
            Source
          </a>
        </span>
      </div>
    </footer>
  );
}
