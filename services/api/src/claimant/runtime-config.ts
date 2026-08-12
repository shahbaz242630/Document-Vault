export const CLAIMANT_PRODUCTION_ACTIVATION_APPROVED = false as const;

export const claimantCapabilityNames = [
  "authentication",
  "registeredRecipient",
  "offlineCodeV2",
  "claimIntake",
  "evidenceUpload",
  "dashboard",
  "caseProcessing",
  "ownerProtection",
  "notifications",
  "review",
  "release",
  "nativeRetrieval",
] as const;

export type ClaimantCapabilityName = (typeof claimantCapabilityNames)[number];
export type ClaimantRuntimeEnvironment = "development" | "test" | "production";

type ClaimantCapabilityRecord = Readonly<Record<ClaimantCapabilityName, boolean>>;

export type ClaimantRuntimeConfig = Readonly<{
  environment: ClaimantRuntimeEnvironment;
  masterEnabled: boolean;
  productionActivationApproved: false;
  requested: ClaimantCapabilityRecord;
  effective: ClaimantCapabilityRecord;
}>;

const MASTER_FLAG = "CLAIMANT_RUNTIME_ENABLED";

const capabilityFlags: Readonly<Record<ClaimantCapabilityName, string>> = {
  authentication: "CLAIMANT_AUTHENTICATION_ENABLED",
  registeredRecipient: "CLAIMANT_REGISTERED_RECIPIENT_ENABLED",
  offlineCodeV2: "CLAIMANT_OFFLINE_CODE_V2_ENABLED",
  claimIntake: "CLAIMANT_INTAKE_ENABLED",
  evidenceUpload: "CLAIMANT_EVIDENCE_UPLOAD_ENABLED",
  dashboard: "CLAIMANT_DASHBOARD_ENABLED",
  caseProcessing: "CLAIMANT_CASE_PROCESSING_ENABLED",
  ownerProtection: "CLAIMANT_OWNER_PROTECTION_ENABLED",
  notifications: "CLAIMANT_NOTIFICATIONS_ENABLED",
  review: "CLAIMANT_REVIEW_ENABLED",
  release: "CLAIMANT_RELEASE_ENABLED",
  nativeRetrieval: "CLAIMANT_NATIVE_RETRIEVAL_ENABLED",
};

const prerequisites: Readonly<
  Partial<Record<ClaimantCapabilityName, readonly ClaimantCapabilityName[]>>
> = {
  registeredRecipient: ["authentication"],
  offlineCodeV2: ["authentication"],
  evidenceUpload: ["claimIntake"],
  dashboard: ["claimIntake"],
  caseProcessing: ["claimIntake"],
  ownerProtection: ["caseProcessing"],
  notifications: ["caseProcessing"],
  review: ["ownerProtection"],
  release: ["review"],
  nativeRetrieval: ["release"],
};

function parseRuntimeEnvironment(value: string | undefined): ClaimantRuntimeEnvironment {
  const normalized = value?.trim() || "development";
  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }
  throw new Error("NODE_ENV must be development, test, or production.");
}

function parseBooleanFlag(env: Record<string, string | undefined>, name: string): boolean {
  const value = env[name]?.trim().toLowerCase();
  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function readRequestedCapabilities(
  env: Record<string, string | undefined>,
): Record<ClaimantCapabilityName, boolean> {
  return Object.fromEntries(
    claimantCapabilityNames.map((capability) => [
      capability,
      parseBooleanFlag(env, capabilityFlags[capability]),
    ]),
  ) as Record<ClaimantCapabilityName, boolean>;
}

function resolveEffectiveCapabilities(
  masterEnabled: boolean,
  requested: Record<ClaimantCapabilityName, boolean>,
): Record<ClaimantCapabilityName, boolean> {
  const effective = Object.fromEntries(
    claimantCapabilityNames.map((capability) => [capability, false]),
  ) as Record<ClaimantCapabilityName, boolean>;

  if (!masterEnabled) return effective;

  for (const capability of claimantCapabilityNames) {
    if (!requested[capability]) continue;

    const requiredCapabilities = prerequisites[capability] ?? [];
    const prerequisitesEnabled = requiredCapabilities.every(
      (requiredCapability) => effective[requiredCapability],
    );
    const routeEnabled =
      capability !== "claimIntake" ||
      effective.registeredRecipient ||
      effective.offlineCodeV2;

    effective[capability] = prerequisitesEnabled && routeEnabled;
  }

  return effective;
}

export function getClaimantRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): ClaimantRuntimeConfig {
  const environment = parseRuntimeEnvironment(env.NODE_ENV);
  const masterEnabled = parseBooleanFlag(env, MASTER_FLAG);
  const requested = readRequestedCapabilities(env);

  if (environment === "production" && (masterEnabled || Object.values(requested).some(Boolean))) {
    throw new Error(
      "Claimant runtime activation is not approved for production. Keep every claimant flag disabled.",
    );
  }

  const effective = resolveEffectiveCapabilities(masterEnabled, requested);

  return Object.freeze({
    environment,
    masterEnabled,
    productionActivationApproved: CLAIMANT_PRODUCTION_ACTIVATION_APPROVED,
    requested: Object.freeze(requested),
    effective: Object.freeze(effective),
  });
}

export class ClaimantCapabilityDisabledError extends Error {
  readonly capability: ClaimantCapabilityName;

  constructor(capability: ClaimantCapabilityName) {
    super(`Claimant capability is disabled: ${capability}.`);
    this.name = "ClaimantCapabilityDisabledError";
    this.capability = capability;
  }
}

export function requireClaimantCapability(
  config: ClaimantRuntimeConfig,
  capability: ClaimantCapabilityName,
): void {
  if (!config.effective[capability]) throw new ClaimantCapabilityDisabledError(capability);
}
