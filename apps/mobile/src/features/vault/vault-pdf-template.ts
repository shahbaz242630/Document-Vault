import type { VaultExportModel } from "./vault-export-model";

export function renderVaultPdfHtml(model: VaultExportModel): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { color: #172026; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { border-bottom: 1px solid #d7dee5; font-size: 20px; margin: 28px 0 12px; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 0 0 10px; }
    .meta, .warning, .field-label { color: #5c6873; }
    .warning { border: 1px solid #d7dee5; margin: 20px 0; padding: 12px; }
    .asset { margin: 0 0 18px; page-break-inside: avoid; }
    .field { margin: 0 0 8px; }
    .field-label { font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .field-value, .notes { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Sanduqkin Vault Export</h1>
  <p class="meta">Generated ${escapeHtml(model.generatedAtLabel)}</p>
  <p class="warning">This file contains sensitive information from your vault. Sanduqkin did not receive or email this file. Store it safely and delete it when no longer needed.</p>
  ${model.sections.map(renderSection).join("")}
</body>
</html>`;
}

function renderSection(section: VaultExportModel["sections"][number]): string {
  return `<section>
  <h2>${escapeHtml(section.label)}</h2>
  ${section.items.map(renderItem).join("")}
</section>`;
}

function renderItem(item: VaultExportModel["sections"][number]["items"][number]): string {
  return `<article class="asset">
  <h3>${escapeHtml(item.title)}</h3>
  ${item.fields.map(renderField).join("")}
  ${item.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}
</article>`;
}

function renderField(field: { label: string; value: string }): string {
  return `<div class="field">
  <div class="field-label">${escapeHtml(field.label)}</div>
  <div class="field-value">${escapeHtml(field.value)}</div>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
