import { describe, expect, it } from "vitest";

import type { VaultExportModel } from "./vault-export-model";
import { renderVaultPdfHtml } from "./vault-pdf-template";

describe("renderVaultPdfHtml", () => {
  it("renders warning copy and escaped vault content", () => {
    const model: VaultExportModel = {
      generatedAtLabel: "03 Jun 2026, 10:00 UTC",
      sections: [
        {
          assetType: "bank_account",
          label: "Bank accounts",
          items: [
            {
              fields: [{ label: "Bank <name>", value: "A&B Bank" }],
              id: "asset-1",
              notes: "Do not leak <script>alert(1)</script>",
              title: "Primary <account>",
            },
          ],
        },
      ],
    };

    const html = renderVaultPdfHtml(model);

    expect(html).toContain("This file contains sensitive information");
    expect(html).toContain("Primary &lt;account&gt;");
    expect(html).toContain("Bank &lt;name&gt;");
    expect(html).toContain("A&amp;B Bank");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
