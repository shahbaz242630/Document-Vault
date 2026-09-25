export const CLAIMANT_RUNTIME_LAUNCH_APPROVED = false as const;
export const CLAIMANT_RUNTIME_FEATURE_ENABLED = false as const;
export const CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED = true as const;

const policy = Object.freeze({
  policy_version: "claimant_runtime_launch_policy_v1" as const,
  source: "bundled_default" as const,
  approved: CLAIMANT_RUNTIME_LAUNCH_APPROVED,
  enabled: CLAIMANT_RUNTIME_FEATURE_ENABLED,
  killSwitchEngaged: CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED,
  synthetic_only: true as const,
  production_runtime: false as const,
  identity_verified: false as const,
  release_authorized: false as const,
});

export function readClaimantRuntimeLaunchPolicy() {
  return policy;
}
