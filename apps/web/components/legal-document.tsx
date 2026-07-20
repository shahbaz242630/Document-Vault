import type { ReactNode } from "react";

import { contentVersion } from "@/lib/site";

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalDocument({ children, eyebrow, summary, title }: LegalDocumentProps) {
  return (
    <main id="main-content" className="legal-page" tabIndex={-1}>
      <header className="legal-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-lede">{summary}</p>
        <div className="draft-notice" role="note" aria-label="Document publication status">
          <strong>Draft for review.</strong>
          <span>This document is not yet effective and must not be relied on as a final policy or agreement.</span>
        </div>
        <dl className="document-meta">
          <div><dt>Version</dt><dd>{contentVersion.label}</dd></div>
          <div><dt>Last reviewed</dt><dd>{contentVersion.reviewed}</dd></div>
          <div><dt>Status</dt><dd>{contentVersion.status}</dd></div>
        </dl>
      </header>
      <article className="legal-content">{children}</article>
    </main>
  );
}
