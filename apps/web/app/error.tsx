"use client";

export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main id="main-content" className="message-page" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>We could not load this page.</h1>
      <p>No vault or account data was affected. You can safely try again.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
