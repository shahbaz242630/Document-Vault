import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonical-json";

describe("canonical claim JSON", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(
      canonicalJson({
        z: [{ y: 2, x: 1 }],
        a: true,
      }),
    ).toBe('{"a":true,"z":[{"x":1,"y":2}]}');
  });

  it("rejects unsafe or fractional numbers", () => {
    expect(() => canonicalJson({ value: 1.5 })).toThrow(
      "safe integers only",
    );
    expect(() =>
      canonicalJson({ value: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow("safe integers only");
  });
});
