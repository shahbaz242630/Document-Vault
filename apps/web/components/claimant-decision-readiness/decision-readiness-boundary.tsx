export function DecisionReadinessBoundary() {
  return (
    <article className="decision-readiness-boundary">
      <p className="eyebrow">Status is not capability</p>
      <h3>This page cannot retrieve or decrypt anything</h3>
      <p>
        A status message does not create a session, serve an encrypted package,
        authorize release, use a private key, or prove that information was opened.
      </p>
    </article>
  );
}
