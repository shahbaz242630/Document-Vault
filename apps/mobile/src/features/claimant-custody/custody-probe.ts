export const CLAIMANT_CUSTODY_PROBE_ENABLED = false as const;

export type CustodyCapability = {
  result_class: string;
  eligible: boolean;
  platform: "ios" | "android";
  key_algorithm: "p256_ecdh";
  public_key_encoding: "ansi_x9_63_uncompressed";
  hardware_security_level: string;
  private_key_exportable: false;
  user_presence_binding: string;
  test_alias_only: true;
};

export type CustodyOperation = {
  result_class: string;
  passed: boolean;
  public_key?: string;
  public_key_fingerprint?: string;
  public_key_encoding?: "ansi_x9_63_uncompressed";
  hardware_security_level?: string;
  private_key_exportable?: false;
  protocol_profile?: "native_enrollment_v1";
  user_presence_binding?: string;
  test_alias_only: true;
};

export type CustodyProbeAdapter = {
  inspectCapabilityAsync(): Promise<CustodyCapability>;
  createTestKeyAsync(): Promise<CustodyOperation>;
  exerciseTestKeyAsync(): Promise<CustodyOperation>;
  deleteTestKeyAsync(): Promise<CustodyOperation>;
};

export type CustodyProbeReport = {
  capability: CustodyCapability;
  creation: CustodyOperation | null;
  exercise: CustodyOperation | null;
  cleanup: CustodyOperation;
  passed: boolean;
};

export function createClaimantCustodyProbe(adapter: CustodyProbeAdapter) {
  return {
    async run(): Promise<CustodyProbeReport> {
      let capability: CustodyCapability;
      let creation: CustodyOperation | null = null;
      let exercise: CustodyOperation | null = null;
      let cleanup!: CustodyOperation;

      try {
        capability = assertCapability(await adapter.inspectCapabilityAsync());
        if (capability.eligible) {
          creation = assertOperation(await adapter.createTestKeyAsync());
          if (creation.passed) {
            exercise = assertOperation(await adapter.exerciseTestKeyAsync());
          }
        }
      } finally {
        // The probe alias is disposable and must be deleted on every exit path.
        cleanup = assertOperation(await adapter.deleteTestKeyAsync());
      }

      return {
        capability,
        creation,
        exercise,
        cleanup,
        passed:
          capability.eligible &&
          creation?.passed === true &&
          exercise?.passed === true &&
          creation.protocol_profile === "native_enrollment_v1" &&
          exercise.protocol_profile === "native_enrollment_v1" &&
          creation.public_key_fingerprint === exercise.public_key_fingerprint &&
          cleanup.passed,
      };
    },
  };
}

function assertCapability(value: CustodyCapability): CustodyCapability {
  if (
    value.test_alias_only !== true ||
    value.private_key_exportable !== false ||
    value.key_algorithm !== "p256_ecdh" ||
    value.public_key_encoding !== "ansi_x9_63_uncompressed"
  ) {
    throw new Error("Claimant custody capability result violates the probe contract.");
  }
  return value;
}

function assertOperation(value: CustodyOperation): CustodyOperation {
  if (value.test_alias_only !== true) {
    throw new Error("Claimant custody operation is not restricted to the test alias.");
  }
  if (
    "private_key" in value ||
    "private_key_bytes" in value ||
    "shared_secret" in value
  ) {
    throw new Error("Claimant custody operation exposed prohibited key material.");
  }
  if (value.public_key !== undefined && !/^B[A-Za-z0-9_-]{86}$/u.test(value.public_key)) {
    throw new Error("Claimant custody operation exposed a non-canonical public key.");
  }
  if (
    value.public_key_fingerprint !== undefined &&
    !/^[A-Za-z0-9_-]{43}$/u.test(value.public_key_fingerprint)
  ) {
    throw new Error("Claimant custody operation exposed an invalid public-key fingerprint.");
  }
  if (
    value.protocol_profile !== undefined &&
    value.protocol_profile !== "native_enrollment_v1"
  ) {
    throw new Error("Claimant custody operation used an unsupported protocol profile.");
  }
  return value;
}
