import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Emergency access settings route", () => {
  it("renders the emergency access setup shell", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain("EmergencyAccessScreen");
    expect(source).toContain("<Screen>");
    expect(source).toContain('router.push("/settings/trusted-person"');
    expect(source).toContain("onOpenTrustedPerson");
  });

  it("stores only an interruption marker while the one-time code is visible", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain(
      'SecureStore.setItemAsync(emergencyAccessPendingConfirmationKey, "true")',
    );
    expect(source).not.toContain(
      "SecureStore.setItemAsync(emergencyAccessPendingConfirmationKey, result.code)",
    );
    expect(source).not.toContain(
      "SecureStore.setItemAsync(emergencyAccessPendingConfirmationKey, oneTimeCode)",
    );
  });

  it("recovers an interrupted setup only from the marker plus an active grant", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain(
      "SecureStore.getItemAsync(emergencyAccessPendingConfirmationKey)",
    );
    expect(source).toContain("repository.loadActiveSealedCodeGrant()");
    expect(source).toContain('"interrupted"');
  });

  it("recovers the active sealed-code state when an active grant exists without a pending marker", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain('setStatus(pending ? "interrupted" : "active")');
  });
});
