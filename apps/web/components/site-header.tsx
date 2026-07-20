import Link from "next/link";

import { primaryNavigation } from "@/lib/site";

function NavigationLinks() {
  return (
    <>
      {primaryNavigation.map(({ href, label }) => (
        <Link href={href} key={href}>
          {label}
        </Link>
      ))}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Sanduqkin home">
        <span aria-hidden="true" className="wordmark-mark">S</span>
        <span>Sanduqkin</span>
      </Link>

      <nav className="desktop-navigation" aria-label="Primary navigation">
        <NavigationLinks />
      </nav>

      <div className="header-status">
        <span className="preview-label">Private preview</span>
        <details className="mobile-menu">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            <NavigationLinks />
          </nav>
        </details>
      </div>
    </header>
  );
}
