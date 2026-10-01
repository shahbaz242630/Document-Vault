import createQrCode from "qrcode-generator";

import type { OwnerSheetCopy } from "./owner-sheet-copy";
import { ownerSheetReference } from "./owner-sheet-reference";

/*
 * Slice 6H, PDF-first since 2026-10-01: the emergency sheet the owner saves as a PDF or prints. The QR code carries
 * the `SKQ2.` payload; the locator and secret are repeated as text for reference. The HTML is rendered only to a
 * temporary PDF or the print dialog, both handled by owner-sheet-export.ts.
 */
export function renderOwnerSheetHtml(sheet: OwnerSheetCopy): string {
  const code = createQrCode(0, "M");
  code.addData(sheet.sheetPayload, "Byte");
  code.make();
  const qrSvg = code.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  const expires = new Date(sheet.expiresAt).toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sanduqkin emergency sheet</title>
<style>
  @page { margin: 18mm; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4mm; }
  .lead { font-size: 11pt; margin: 0 0 8mm; }
  .qr { width: 80mm; height: 80mm; margin: 0 auto 8mm; }
  .qr svg { width: 100%; height: 100%; }
  dl { font-size: 10pt; margin: 0 0 8mm; }
  dt { font-weight: 600; margin-top: 3mm; }
  dd { margin: 1mm 0 0; font-family: "Courier New", monospace; font-size: 11pt; word-break: break-all; }
  ol { font-size: 10.5pt; padding-left: 6mm; }
  li { margin-bottom: 2mm; }
  .warning { border: 1pt solid #111; padding: 3mm 4mm; font-size: 10pt; margin-top: 6mm; }
</style>
</head>
<body>
<h1>Sanduqkin emergency sheet</h1>
<p class="lead">This sheet lets the person you trust start a claim for your Sanduqkin vault if something happens to you.</p>
<div class="qr">${qrSvg}</div>
<dl>
  <dt>Sheet code</dt><dd>${escapeHtml(sheet.printedLocator)}</dd>
  <dt>Secret code</dt><dd>${escapeHtml(sheet.printedSecret)}</dd>
  <dt>Valid until</dt><dd>${escapeHtml(expires)}</dd>
  <dt>Reference</dt><dd>${escapeHtml(ownerSheetReference(sheet.locatorRecordId))}</dd>
</dl>
<ol>
  <li>Open the Sanduqkin app and choose <strong>Start a claim with an emergency sheet</strong>.</li>
  <li>Scan the QR code above with the phone's camera.</li>
  <li>Follow the steps in the app. Sanduqkin reviews every claim before anything is released.</li>
</ol>
<p class="warning">Keep this sheet, printed or as a PDF, somewhere safe and private. Anyone holding it can start a
claim, so store it as you would a will or a spare house key.</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    "'": "&#39;" })[character] ?? character);
}
