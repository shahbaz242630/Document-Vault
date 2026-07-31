import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("TrustedPersonInformationScreen", () => {
  it("explains the future setup without enabling claimant runtime", () => {
    const source = readFileSync(
      resolve(__dirname, "trusted-person-information-screen.tsx"),
      "utf8",
    );

    expect(source).toContain("Setup is not available yet");
    expect(source).toContain("No invitation has been created");
    expect(source).toContain("full identity, evidence, review, and");
    expect(source).toContain("does not automatically give them access");
    expect(source).not.toContain("TextInput");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("fetch(");
  });
});
