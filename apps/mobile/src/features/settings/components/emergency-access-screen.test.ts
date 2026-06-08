import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("EmergencyAccessScreen", () => {
  it("presents pre-authorized kin as the recommended option", () => {
    const source = readFileSync(
      resolve(__dirname, "emergency-access-screen.tsx"),
      "utf8",
    );

    expect(source).toContain("Pre-Authorized Kin");
    expect(source).toContain("Highly recommended");
    expect(source).toContain("verify their account in advance");
    expect(source).toContain("Sanduqkin cannot read your saved information");
  });

  it("presents sealed emergency code as a backup with risk copy", () => {
    const source = readFileSync(
      resolve(__dirname, "emergency-access-screen.tsx"),
      "utf8",
    );

    expect(source).toContain("Sealed Emergency Code");
    expect(source).toContain("Backup option");
    expect(source).toContain("Sanduqkin cannot recover this code");
    expect(source).toContain("Someone with the code may be able to access");
  });

  it("supports the sealed emergency code setup states", () => {
    const source = readFileSync(
      resolve(__dirname, "emergency-access-screen.tsx"),
      "utf8",
    );

    expect(source).toContain("Set up trusted person");
    expect(source).toContain("Create emergency code");
    expect(source).toContain("Write this code down now. Sanduqkin cannot show it again after you confirm.");
    expect(source).toContain("Regenerate code");
    expect(source).toContain("Revoke code");
    expect(source).toContain("Revoke unusable code");
    expect(source).toContain("usePreventScreenCapture");
    expect(source).not.toContain("router.setParams");
  });
});
