import { schemaDrivenVaultCategories } from "@vault/shared-validation";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SchemaDrivenVaultForm } from "./schema-driven-vault-form";

describe("SchemaDrivenVaultForm", () => {
  it("renders every registered category and field without browser persistence", () => {
    for (const definition of schemaDrivenVaultCategories) {
      const markup = renderToStaticMarkup(<SchemaDrivenVaultForm
        busy={false}
        definition={definition}
        onSave={vi.fn()}
      />);
      expect(markup).toContain(`data-asset-type="${definition.assetType}"`);
      expect(markup).toContain('autoComplete="off"');
      for (const field of definition.fields) {
        expect(markup).toContain(`name="${field.name}"`);
        expect(markup).toContain(field.label);
      }
    }
  });
});
