import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("BiometricSetupPanel wiring", () => {
  it("caches the current MEK before marking onboarding biometric unlock enabled", () => {
    const source = readFileSync(resolve(__dirname, "biometric-setup-panel.tsx"), "utf8");

    expect(source).toContain("createBiometricPreferenceService");
    expect(source).toContain("mekStorage: createMekStorage(storage)");
    expect(source).toContain("const result = await biometricPreference.enable();");
    expect(source).not.toContain("await biometricStorage.setEnabled(true)");
  });
});
