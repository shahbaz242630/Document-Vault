const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { extname, join } = require("node:path");

const repositoryRoot = join(__dirname, "..");
const featureDirectory = join(
  repositoryRoot,
  "apps",
  "mobile",
  "src",
  "features",
  "claimant-custody",
);
const moduleDirectory = join(
  repositoryRoot,
  "apps",
  "mobile",
  "modules",
  "claimant-key-custody",
);
const enrollmentDirectory = join(
  repositoryRoot,
  "apps",
  "mobile",
  "src",
  "features",
  "claimant-enrollment",
);
const probeAppDirectory = join(repositoryRoot, "apps", "mobile", "probe-app");
const appAttestProbeAppDirectory = join(repositoryRoot, "apps", "mobile", "app-attest-probe-app");

for (const directory of [featureDirectory, enrollmentDirectory, moduleDirectory, probeAppDirectory, appAttestProbeAppDirectory]) {
  if (!existsSync(directory)) {
    throw new Error(`Claimant custody probe directory is missing: ${directory}`);
  }
}

const sources = [
  ...sourceFiles(featureDirectory),
  ...sourceFiles(moduleDirectory),
  ...sourceFiles(probeAppDirectory),
  ...sourceFiles(appAttestProbeAppDirectory),
];
const forbiddenRuntimeTokens = [
  "@supabase",
  "createClient(",
  "fetch(",
  "axios",
  "recipient_public_keys",
  "recipient_invitations",
  "release_packages",
  "notification_outbox",
  "localStorage",
  "sessionStorage",
  "AsyncStorage",
  "expo-secure-store",
];

for (const path of sources) {
  const source = readFileSync(path, "utf8");
  for (const token of forbiddenRuntimeTokens) {
    if (source.includes(token)) {
      throw new Error(
        `Claimant custody probe source ${path} contains forbidden runtime token ${token}.`,
      );
    }
  }
  if (!path.endsWith(".test.ts")) {
    for (const resultField of ["private_key", "private_key_bytes", "shared_secret", "proof_key", "proof_mac"]) {
      const quotedField = new RegExp(`["']${resultField}["']\\s*[:=]`);
      if (quotedField.test(source)) {
        throw new Error(
          `Claimant custody probe source ${path} exposes prohibited result field ${resultField}.`,
        );
      }
    }
  }
}

const featureSource = readFileSync(
  join(featureDirectory, "custody-probe.ts"),
  "utf8",
);
if (!/CLAIMANT_CUSTODY_PROBE_ENABLED\s*=\s*false\s+as\s+const/.test(featureSource)) {
  throw new Error("Claimant custody probe is not hard-disabled.");
}
const physicalEvidenceSource = readFileSync(
  join(featureDirectory, "physical-evidence-runner.ts"),
  "utf8",
);
if (!/CLAIMANT_PHYSICAL_EVIDENCE_APP_ENTRY_ENABLED\s*=\s*false\s+as\s+const/.test(physicalEvidenceSource)) {
  throw new Error("Claimant physical evidence application entry is not hard-disabled.");
}
const appAttestContractSource = readFileSync(
  join(featureDirectory, "app-attest-contract.ts"),
  "utf8",
);
if (!/CLAIMANT_APP_ATTEST_RUNTIME_ENABLED\s*=\s*false\s+as\s+const/.test(appAttestContractSource)) {
  throw new Error("Claimant App Attest runtime contract is not hard-disabled.");
}
const appAttestAdapterSource = readFileSync(
  join(featureDirectory, "app-attest-adapter.ts"),
  "utf8",
);
if (!/CLAIMANT_APP_ATTEST_ADAPTER_ENABLED\s*=\s*false\s+as\s+const/.test(appAttestAdapterSource)) {
  throw new Error("Claimant native App Attest adapter is not hard-disabled.");
}
const appAttestEvidenceSource = readFileSync(
  join(featureDirectory, "app-attest-evidence-runner.ts"),
  "utf8",
);
if (!/CLAIMANT_APP_ATTEST_EVIDENCE_ENTRY_ENABLED\s*=\s*false\s+as\s+const/.test(appAttestEvidenceSource)) {
  throw new Error("Claimant App Attest evidence entry is not hard-disabled.");
}
const enrollmentCoordinatorSource = readFileSync(
  join(enrollmentDirectory, "native-enrollment-coordinator.ts"),
  "utf8",
);
if (!/CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/.test(enrollmentCoordinatorSource)) {
  throw new Error("Claimant native enrollment coordinator is not hard-disabled.");
}
const enrollmentAttemptStoreSource = readFileSync(
  join(enrollmentDirectory, "native-enrollment-attempt-store.ts"),
  "utf8",
);
if (!/CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED\s*=\s*false\s+as\s+const/.test(enrollmentAttemptStoreSource)) {
  throw new Error("Claimant native enrollment attempt persistence is not hard-disabled.");
}
const enrollmentAdaptersSource = readFileSync(
  join(enrollmentDirectory, "native-enrollment-adapters.ts"),
  "utf8",
);
const enrollmentRuntimeSource = readFileSync(
  join(enrollmentDirectory, "native-enrollment-runtime.ts"),
  "utf8",
);
if (!/CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED\s*=\s*false\s+as\s+const/.test(enrollmentAdaptersSource)) {
  throw new Error("Claimant production-shaped native lifecycle adapters are not hard-disabled.");
}
if (!/CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED\s*=\s*false\s+as\s+const/.test(enrollmentRuntimeSource)) {
  throw new Error("Claimant native enrollment composition runtime is not hard-disabled.");
}
for (const prohibitedProbeBinding of ["createTestKeyAsync", "exerciseTestKeyAsync", "deleteTestKeyAsync",
  "ensureTestKeyAsync", "attestTestKeyAsync", "generateTestAssertionAsync", "test_alias_only", "probe-only"]) {
  if (enrollmentAdaptersSource.includes(prohibitedProbeBinding) || enrollmentRuntimeSource.includes(prohibitedProbeBinding)) {
    throw new Error(`Claimant production-shaped enrollment boundary imports or promotes probe binding ${prohibitedProbeBinding}.`);
  }
}
for (const requiredProductionBinding of ["createClaimantKeyAsync", "createClaimantPossessionProofAsync",
  "deleteClaimantKeyAsync", "ensureAppAttestKeyAsync", "attestAppAttestKeyAsync",
  "generateAppAttestAssertionAsync", "claimant-enrollment\\.v1"] ) {
  if (!enrollmentAdaptersSource.includes(requiredProductionBinding)) {
    throw new Error(`Claimant production-shaped enrollment adapters are missing ${requiredProductionBinding}.`);
  }
}
for (const prohibitedAttemptField of ["bearer_token", "recovery_phrase", "private_key", "proof_mac", "assertion_object", "attestation_object"]) {
  if (enrollmentAttemptStoreSource.includes(`${prohibitedAttemptField}:`)) {
    throw new Error(`Claimant enrollment attempt persistence declares prohibited field ${prohibitedAttemptField}.`);
  }
}
for (const prohibitedProbeBinding of [
  "claimant-key-custody",
  "app-attest-adapter",
  "custody-probe",
  "test_alias_only",
]) {
  if (enrollmentCoordinatorSource.includes(prohibitedProbeBinding)) {
    throw new Error(`Claimant native enrollment coordinator imports or promotes probe boundary ${prohibitedProbeBinding}.`);
  }
}
for (const prohibitedNativeRuntimeToken of ["DeviceCheck", "DCAppAttestService", "generateKey", "attestKey", "generateAssertion"]) {
  if (appAttestContractSource.includes(prohibitedNativeRuntimeToken)) {
    throw new Error(`Claimant App Attest contract contains native runtime token ${prohibitedNativeRuntimeToken}.`);
  }
}
const probeAppSource = readFileSync(join(probeAppDirectory, "index.tsx"), "utf8");
for (const requiredProbeImport of [
  "modules/claimant-key-custody/src",
  "features/claimant-custody/physical-evidence-runner",
]) {
  if (!probeAppSource.includes(requiredProbeImport)) {
    throw new Error(`Physical iPhone probe host is missing ${requiredProbeImport}.`);
  }
}
const appAttestProbeAppSource = readFileSync(join(appAttestProbeAppDirectory, "index.tsx"), "utf8");
for (const requiredProbeImport of [
  "claimantAppAttestNative",
  "createClaimantAppAttestEvidenceRunner",
]) {
  if (!appAttestProbeAppSource.includes(requiredProbeImport)) {
    throw new Error(`App Attest probe host is missing ${requiredProbeImport}.`);
  }
}
for (const prohibitedEvidenceField of [
  "app_attest_key_id", "attestation_object", "assertion_object", "receipt", "counter",
  "certificate_chain", "native_error", "challenge_bytes", "client_data_hash",
]) {
  const resultField = new RegExp(`^[ \\t]+${prohibitedEvidenceField}:`, "m");
  if (resultField.test(appAttestEvidenceSource)) {
    throw new Error(`Claimant App Attest evidence report exposes ${prohibitedEvidenceField}.`);
  }
}
const appConfigSource = readFileSync(
  join(repositoryRoot, "apps", "mobile", "app.config.js"),
  "utf8",
);
for (const requiredBuildIsolation of [
  'const PROBE_TARGET = "claimant_custody_probe"',
  'const APP_ATTEST_PROBE_TARGET = "claimant_app_attest_probe"',
  '"./probe-app"',
  '"./app-attest-probe-app"',
  '"./app"',
  '"com.sanduqkin.mobile.claimantprobe"',
  '"com.sanduqkin.mobile.claimantappattestprobe"',
  '"com.apple.developer.devicecheck.appattest-environment"',
]) {
  if (!appConfigSource.includes(requiredBuildIsolation)) {
    throw new Error(`Claimant custody build isolation is missing ${requiredBuildIsolation}.`);
  }
}
for (const prohibitedEvidenceField of [
  "device_identifier",
  "device_name",
  "public_key",
  "public_key_fingerprint",
  "proof_mac",
  "nonce",
  "kdf_salt",
]) {
  const resultField = new RegExp(`^[ \\t]+${prohibitedEvidenceField}:`, "m");
  if (resultField.test(physicalEvidenceSource)) {
    throw new Error(`Claimant physical evidence report exposes ${prohibitedEvidenceField}.`);
  }
}

for (const path of [
  ...sourceFiles(join(repositoryRoot, "apps", "mobile", "app")),
  ...sourceFiles(join(repositoryRoot, "apps", "mobile", "src")).filter(
    (path) => !path.startsWith(featureDirectory) && !path.startsWith(enrollmentDirectory),
  ),
]) {
  const source = readFileSync(path, "utf8");
  if (
    source.includes("claimant-key-custody") ||
    source.includes("features/claimant-custody") ||
    source.includes("features/claimant-enrollment")
  ) {
    throw new Error(`Claimant runtime source imports a disconnected claimant native feature: ${path}`);
  }
}

for (const nativeSource of [
  join(moduleDirectory, "ios", "ClaimantKeyCustodyModule.swift"),
  join(
    moduleDirectory,
    "android",
    "src",
    "main",
    "java",
    "com",
    "sanduqkin",
    "claimantkeycustody",
    "ClaimantKeyCustodyModule.kt",
  ),
]) {
  const source = readFileSync(nativeSource, "utf8");
  if (!source.includes("probe-only")) {
    throw new Error(`Native custody source lacks a probe-only key alias: ${nativeSource}`);
  }
}

const iosSource = readFileSync(
  join(moduleDirectory, "ios", "ClaimantKeyCustodyModule.swift"),
  "utf8",
);
for (const requiredBoundary of [
  'private let testAlias = "com.sanduqkin.claimant-custody.probe-only.v3"',
  'private let protocolName = "sanduqkin:claim:native-enrollment:v1"',
  'private let fingerprintLabel = "sanduqkin:claim:native-enrollment:public-key:v1"',
  'private let proofKeyLabel = "sanduqkin:claim:native-enrollment:proof-key:v1"',
  'private let proofMacLabel = "sanduqkin:claim:native-enrollment:proof-mac:v1"',
  "kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly",
  "[.privateKeyUsage, .userPresence]",
  "SecureEnclave.P256.KeyAgreement.PrivateKey",
  "SecRandomCopyBytes",
  "JSONSerialization.data",
  ".sortedKeys",
  ".withoutEscapingSlashes",
  "hkdfDerivedSymmetricKey",
  "HMAC<SHA256>.isValidAuthenticationCode",
  '"protocol_profile": "native_enrollment_v1"',
]) {
  if (!iosSource.includes(requiredBoundary)) {
    throw new Error(`iOS claimant custody probe is missing required boundary: ${requiredBoundary}.`);
  }
}

const appAttestIosSource = readFileSync(
  join(moduleDirectory, "ios", "ClaimantAppAttestModule.swift"),
  "utf8",
);
for (const requiredBoundary of [
  "import DeviceCheck",
  'Name("ClaimantAppAttest")',
  'private let appAttestKeychainService = "com.sanduqkin.claimant-app-attest.probe-only"',
  'private let appAttestProbeBundleIdentifier = "com.sanduqkin.mobile.claimantappattestprobe"',
  "guard isAppAttestProbeBundle() else",
  'resultClass: "probe_build_required"',
  "#available(iOS 27.0, *)",
  "DCAppAttestService.shared.isSupported",
  "DCAppAttestService.shared.generateKey()",
  "DCAppAttestService.shared.attestKey",
  "DCAppAttestService.shared.generateAssertion",
  "kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly",
  "Data(SHA256.hash(data: bytes))",
  '"protocol_profile": "app_attest_adapter_v1"',
  '"test_alias_only": true',
]) {
  if (!appAttestIosSource.includes(requiredBoundary)) {
    throw new Error(`iOS App Attest adapter is missing required boundary: ${requiredBoundary}.`);
  }
}
if ((appAttestIosSource.match(/guard isAppAttestProbeBundle\(\) else/g) ?? []).length !== 5) {
  throw new Error("Every iOS App Attest operation must enforce the isolated bundle identity.");
}
for (const method of [
  "inspectCapabilityAsync",
  "ensureTestKeyAsync",
  "attestTestKeyAsync",
  "generateTestAssertionAsync",
  "clearTestKeyIdentifierAsync",
]) {
  if (!appAttestIosSource.includes(`AsyncFunction("${method}")`)) {
    throw new Error(`iOS App Attest adapter is missing ${method}.`);
  }
}
if ((appAttestIosSource.match(/AsyncFunction\(/g) ?? []).length !== 5) {
  throw new Error("iOS App Attest adapter exposes an unexpected native method.");
}
for (const prohibitedOutput of [
  '"receipt"', '"certificate_chain"', '"counter"', '"native_error"',
  '"client_data_hash"', '"challenge_bytes"',
]) {
  if (appAttestIosSource.includes(prohibitedOutput)) {
    throw new Error(`iOS App Attest adapter exposes prohibited output ${prohibitedOutput}.`);
  }
}
for (const method of [
  "inspectCapabilityAsync",
  "createTestKeyAsync",
  "exerciseTestKeyAsync",
  "deleteTestKeyAsync",
]) {
  if (!iosSource.includes(`AsyncFunction("${method}")`)) {
    throw new Error(`iOS claimant custody probe is missing ${method}.`);
  }
}
if ((iosSource.match(/AsyncFunction\(/g) ?? []).length !== 4) {
  throw new Error("iOS claimant custody probe exposes an unexpected native method.");
}
if (!/base64EncodedString\(\)[\s\S]*replacingOccurrences\(of: "\+", with: "-"\)[\s\S]*replacingOccurrences\(of: "\/", with: "_"\)[\s\S]*replacingOccurrences\(of: "=", with: ""\)/.test(iosSource)) {
  throw new Error("iOS claimant custody probe does not emit unpadded Base64URL.");
}

function sourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const result = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (
      [".ts", ".tsx", ".swift", ".kt", ".json", ".gradle", ".xml", ".podspec"].includes(
        extname(path),
      )
    ) {
      result.push(path);
    }
  }
  return result;
}
