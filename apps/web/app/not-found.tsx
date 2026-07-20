import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main id="main-content" className="message-page" tabIndex={-1}>
      <p className="eyebrow">404</p>
      <h1>This page is not here.</h1>
      <p>The address may have changed, or the page may not be part of this preview.</p>
      <Link className="button-link" href="/">
        Return home
      </Link>
    </main>
  );
}
