import { describe, expect, it, vi } from "vitest";

import { exportVaultPdf } from "./vault-pdf-exporter";

describe("exportVaultPdf", () => {
  it("prints HTML to a local PDF and opens native share", async () => {
    const printToFileAsync = vi.fn().mockResolvedValue({ uri: "file:///tmp/vault.pdf" });
    const shareAsync = vi.fn().mockResolvedValue(undefined);

    await exportVaultPdf({
      html: "<html><body>Vault</body></html>",
      printToFileAsync,
      shareAsync,
    });

    expect(printToFileAsync).toHaveBeenCalledWith({
      html: "<html><body>Vault</body></html>",
    });
    expect(shareAsync).toHaveBeenCalledWith("file:///tmp/vault.pdf", {
      UTI: ".pdf",
      mimeType: "application/pdf",
    });
  });

  it("throws a generic error if PDF generation fails", async () => {
    await expect(
      exportVaultPdf({
        html: "<html><body>Secret account</body></html>",
        printToFileAsync: vi.fn().mockRejectedValue(new Error("Secret account leaked")),
        shareAsync: vi.fn(),
      }),
    ).rejects.toThrow("PDF export failed.");
  });
});
