import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Emergency access settings route", () => {
  it("renders the emergency access setup shell", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain("EmergencyAccessScreen");
    expect(source).toContain('title: "Emergency access"');
  });

  it("stores only an interruption marker while the one-time code is visible", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain('SecureStore.setItemAsync(pendingConfirmationKey, "true")');
    expect(source).not.toContain("SecureStore.setItemAsync(pendingConfirmationKey, result.code)");
    expect(source).not.toContain("SecureStore.setItemAsync(pendingConfirmationKey, oneTimeCode)");
  });

  it("recovers an interrupted setup only from the marker plus an active grant", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain("SecureStore.getItemAsync(pendingConfirmationKey)");
    expect(source).toContain("repository.loadActiveSealedCodeGrant()");
    expect(source).toContain('"interrupted"');
  });

  it("recovers the active sealed-code state when an active grant exists without a pending marker", () => {
    const source = readFileSync(resolve(__dirname, "../../app/settings/emergency-access.tsx"), "utf8");

    expect(source).toContain('setStatus(pending ? "interrupted" : "active")');
  });
});
