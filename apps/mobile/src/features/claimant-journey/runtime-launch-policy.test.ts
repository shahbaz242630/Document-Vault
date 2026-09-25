import { describe, expect, it } from "vitest";

import {
  CLAIMANT_RUNTIME_FEATURE_ENABLED,
  CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED,
  CLAIMANT_RUNTIME_LAUNCH_APPROVED,
  readClaimantRuntimeLaunchPolicy,
} from "./runtime-launch-policy";

describe("claimant runtime launch policy", () => {
  it("ships with all launch authority disabled", () => {
    expect(CLAIMANT_RUNTIME_LAUNCH_APPROVED).toBe(false);
    expect(CLAIMANT_RUNTIME_FEATURE_ENABLED).toBe(false);
    expect(CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED).toBe(true);
  });

  it("returns one frozen, value-free bundled policy", () => {
    const first = readClaimantRuntimeLaunchPolicy();
    const second = readClaimantRuntimeLaunchPolicy();

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual({
      policy_version: "claimant_runtime_launch_policy_v1",
      source: "bundled_default",
      approved: false,
      enabled: false,
      killSwitchEngaged: true,
      synthetic_only: true,
      production_runtime: false,
      identity_verified: false,
      release_authorized: false,
    });
  });
});
