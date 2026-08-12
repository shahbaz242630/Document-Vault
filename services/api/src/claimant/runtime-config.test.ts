import { describe, expect, it } from "vitest";

import {
  CLAIMANT_PRODUCTION_ACTIVATION_APPROVED,
  ClaimantCapabilityDisabledError,
  claimantCapabilityNames,
  getClaimantRuntimeConfig,
  requireClaimantCapability,
} from "./runtime-config.js";

describe("claimant runtime configuration", () => {
  it("defaults every claimant capability to disabled", () => {
    const config = getClaimantRuntimeConfig({ NODE_ENV: "test" });

    expect(CLAIMANT_PRODUCTION_ACTIVATION_APPROVED).toBe(false);
    expect(config.masterEnabled).toBe(false);
    expect(config.productionActivationApproved).toBe(false);
    expect(config.requested).toEqual(
      Object.fromEntries(claimantCapabilityNames.map((capability) => [capability, false])),
    );
    expect(config.effective).toEqual(config.requested);
  });

  it("uses the master switch as a fail-closed shutdown", () => {
    const config = getClaimantRuntimeConfig({
      NODE_ENV: "test",
      CLAIMANT_AUTHENTICATION_ENABLED: "true",
      CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true",
    });

    expect(config.requested.authentication).toBe(true);
    expect(config.effective.authentication).toBe(false);
    expect(config.effective.registeredRecipient).toBe(false);
    expect(config.effective.claimIntake).toBe(false);
  });

  it("enables a local registered-recipient chain only when every dependency is effective", () => {
    const config = getClaimantRuntimeConfig({
      NODE_ENV: "test",
      CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true",
      CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true",
      CLAIMANT_EVIDENCE_UPLOAD_ENABLED: "true",
      CLAIMANT_DASHBOARD_ENABLED: "true",
      CLAIMANT_CASE_PROCESSING_ENABLED: "true",
      CLAIMANT_OWNER_PROTECTION_ENABLED: "true",
      CLAIMANT_NOTIFICATIONS_ENABLED: "true",
      CLAIMANT_REVIEW_ENABLED: "true",
      CLAIMANT_RELEASE_ENABLED: "true",
      CLAIMANT_NATIVE_RETRIEVAL_ENABLED: "true",
    });

    expect(config.effective).toEqual({
      authentication: true,
      registeredRecipient: true,
      offlineCodeV2: false,
      claimIntake: true,
      evidenceUpload: true,
      dashboard: true,
      caseProcessing: true,
      ownerProtection: true,
      notifications: true,
      review: true,
      release: true,
      nativeRetrieval: true,
    });
  });

  it("allows an independent kill switch to disable every downstream capability", () => {
    const config = getClaimantRuntimeConfig({
      NODE_ENV: "development",
      CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true",
      CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true",
      CLAIMANT_EVIDENCE_UPLOAD_ENABLED: "true",
      CLAIMANT_DASHBOARD_ENABLED: "true",
      CLAIMANT_CASE_PROCESSING_ENABLED: "false",
      CLAIMANT_OWNER_PROTECTION_ENABLED: "true",
      CLAIMANT_NOTIFICATIONS_ENABLED: "true",
      CLAIMANT_REVIEW_ENABLED: "true",
      CLAIMANT_RELEASE_ENABLED: "true",
      CLAIMANT_NATIVE_RETRIEVAL_ENABLED: "true",
    });

    expect(config.effective.claimIntake).toBe(true);
    expect(config.effective.evidenceUpload).toBe(true);
    expect(config.effective.dashboard).toBe(true);
    expect(config.effective.caseProcessing).toBe(false);
    expect(config.effective.ownerProtection).toBe(false);
    expect(config.effective.notifications).toBe(false);
    expect(config.effective.review).toBe(false);
    expect(config.effective.release).toBe(false);
    expect(config.effective.nativeRetrieval).toBe(false);
  });

  it("accepts the V2 route as the intake prerequisite without enabling V1 behavior", () => {
    const config = getClaimantRuntimeConfig({
      NODE_ENV: "test",
      CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true",
      CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true",
    });

    expect(config.effective.registeredRecipient).toBe(false);
    expect(config.effective.offlineCodeV2).toBe(true);
    expect(config.effective.claimIntake).toBe(true);
  });

  it("rejects malformed flags instead of guessing", () => {
    expect(() =>
      getClaimantRuntimeConfig({
        NODE_ENV: "test",
        CLAIMANT_RUNTIME_ENABLED: "1",
      }),
    ).toThrow("CLAIMANT_RUNTIME_ENABLED must be true or false.");
  });

  it("rejects every attempted claimant activation in production", () => {
    expect(() =>
      getClaimantRuntimeConfig({
        NODE_ENV: "production",
        CLAIMANT_AUTHENTICATION_ENABLED: "true",
      }),
    ).toThrow("Claimant runtime activation is not approved for production");

    expect(() =>
      getClaimantRuntimeConfig({
        NODE_ENV: "production",
        CLAIMANT_RUNTIME_ENABLED: "true",
      }),
    ).toThrow("Claimant runtime activation is not approved for production");
  });

  it("provides a typed guard for future route and processor wiring", () => {
    const config = getClaimantRuntimeConfig({ NODE_ENV: "test" });

    expect(() => requireClaimantCapability(config, "claimIntake")).toThrow(
      ClaimantCapabilityDisabledError,
    );
    expect(() => requireClaimantCapability(config, "claimIntake")).toThrow(
      "Claimant capability is disabled: claimIntake.",
    );
  });
});
