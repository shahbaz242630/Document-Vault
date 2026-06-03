import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("SettingsScreen biometric preferences", () => {
  it("renders the signed-in biometric preference control before sign out", () => {
    const source = readFileSync(resolve(__dirname, "settings-screen.tsx"), "utf8");

    expect(source).toContain("BiometricPreferencesPanel");
    expect(source.indexOf("BiometricPreferencesPanel")).toBeLessThan(
      source.indexOf("SignOutButton"),
    );
  });
});

describe("SettingsScreen emergency access entry", () => {
  it("links to emergency access before account deletion", () => {
    const source = readFileSync(resolve(__dirname, "settings-screen.tsx"), "utf8");

    expect(source).toContain("/settings/emergency-access");
    expect(source).toContain("Emergency access");
    expect(source.indexOf("Emergency access")).toBeLessThan(
      source.indexOf("Delete account"),
    );
  });
});
