import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Trusted person settings route", () => {
  it("renders only the gated information screen", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/settings/trusted-person.tsx"),
      "utf8",
    );

    expect(source).toContain("TrustedPersonInformationScreen");
    expect(source).toContain("<Screen>");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("fetch(");
  });
});
