export default function HomePage() {
  return (
    <main id="main-content" className="hero">
      <div className="hero-copy">
        <p className="eyebrow">A secure home for what matters</p>
        <h1>The Sanduqkin web foundation is ready.</h1>
        <p className="lede">
          This protected preview establishes the public website workspace. Product,
          legal, and trusted-recipient experiences will arrive in reviewed slices.
        </p>
      </div>

      <aside className="status-card" aria-labelledby="preview-status">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <h2 id="preview-status">Foundation only</h2>
          <p>No accounts, claims, or vault data are available in this preview.</p>
        </div>
      </aside>
    </main>
  );
}
