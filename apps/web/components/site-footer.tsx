import Link from "next/link";

import { legalNavigation, primaryNavigation } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link className="wordmark" href="/" aria-label="Sanduqkin home">
          Sanduqkin
        </Link>
        <p>Private records. Clear control. Thoughtful continuity.</p>
        <span className="footer-note">Informational preview — claims are not active.</span>
      </div>

      <nav aria-label="Product links">
        <h2>Product</h2>
        {primaryNavigation.map(({ href, label }) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>

      <nav aria-label="Legal and support links">
        <h2>Legal &amp; support</h2>
        {legalNavigation.map(({ href, label }) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
        <Link href="/support">Support</Link>
      </nav>

      <div className="footer-utility">
        <h2>Service</h2>
        <a href="/health.json">Static health signal</a>
        <p>© 2026 Sanduqkin. Preview content.</p>
      </div>
    </footer>
  );
}
