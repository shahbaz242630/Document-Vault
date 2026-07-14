import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("DynamicAssetForm accessibility", () => {
  it("exposes stable semantic labels for encrypted-record E2E fields", () => {
    const source = readFileSync(resolve(__dirname, "dynamic-asset-form.tsx"), "utf8");

    expect(source).toContain('accessibilityLabel={`${field.name} field`}');
  });
});
