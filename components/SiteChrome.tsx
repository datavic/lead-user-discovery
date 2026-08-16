import Link from "next/link";

const CONTACT_EMAIL = "victoriaklimova@gmail.com";
const LINKEDIN = "https://www.linkedin.com/in/victoriaklimova/";
const REPO = "https://github.com/datavic/lead-user-discovery";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
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
