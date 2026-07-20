import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Accessibility statement — draft",
  description: "Draft accessibility statement and WCAG 2.2 AA target for the Sanduqkin informational website.",
};

export default function AccessibilityPage() {
  return (
    <LegalDocument
      eyebrow="Accessibility statement"
      title="Private information should also be accessible information."
      summary="Sanduqkin is working toward WCAG 2.2 Level AA for this informational website. This draft records the target and current review status; it is not a conformance claim."
    >
      <section><h2>Our target</h2><p>The informational website is designed toward Web Content Accessibility Guidelines (WCAG) 2.2 Level AA. We have not yet commissioned an independent accessibility audit and do not claim full conformance.</p></section>
      <section><h2>What the preview supports</h2><ul><li>Semantic headings, lists, landmarks, and link text.</li><li>A skip link that moves keyboard focus to the main content.</li><li>Visible keyboard focus and a logical document-first focus order.</li><li>Responsive reflow from small mobile screens through large desktop displays.</li><li>Text alternatives or accessible labels for meaningful non-text elements.</li><li>Reduced-motion preferences and no time-limited or flashing content.</li><li>Readable HTML for legal and support information without a document download.</li></ul></section>
      <section><h2>Known preview limits</h2><p>The final brand, legal content, contact path, browser and assistive-technology matrix, zoom/text-spacing checks, and independent audit are pending. The private Vercel preview also requires reviewer authentication at the hosting layer; that protection is not part of the intended public experience.</p></section>
      <section><h2>Feedback and assistance</h2><p>A verified accessibility-feedback contact and response target must be published before launch. Until then, this preview does not accept personal or support information. Do not include passwords, recovery phrases, emergency codes, private keys, or vault content in an accessibility report.</p></section>
      <section><h2>Assessment record</h2><p>This statement is versioned with the website. Automated checks, keyboard review, responsive browser smoke, contrast review, and representative assistive-technology testing will be recorded before the statement becomes effective.</p></section>
    </LegalDocument>
  );
}
