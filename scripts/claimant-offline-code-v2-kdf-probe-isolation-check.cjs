const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const mobile = join(root, "apps/mobile");
const hostRoot = join(mobile, "offline-code-kdf-probe-app");
const host = readFileSync(join(hostRoot, "index.tsx"), "utf8");
const fixture = readFileSync(join(mobile,
  "src/features/claimant-offline-code/offline-code-v2-kdf-probe-fixture.ts"), "utf8");
const config = readFileSync(join(mobile, "app.config.js"), "utf8");
const eas = JSON.parse(readFileSync(join(mobile, "eas.json"), "utf8"));
for (const token of ['const OFFLINE_CODE_KDF_PROBE_TARGET = "claimant_offline_code_kdf_probe"',
  '"./offline-code-kdf-probe-app"', '"com.sanduqkin.mobile.claimantkdfprobe"',
  '"sanduqkin-claimant-kdf-probe"'])
  if (!config.includes(token)) throw new Error(`Offline-code KDF probe build isolation is missing ${token}.`);
const profile = eas.build?.["claimant-offline-code-kdf-probe"];
if (JSON.stringify(profile) !== JSON.stringify({ developmentClient: false, distribution: "internal",
  environment: "preview", env: { SANDUQKIN_BUILD_TARGET: "claimant_offline_code_kdf_probe" },
  android: { buildType: "apk" }, ios: { credentialsSource: "remote", simulator: false } }))
  throw new Error("Offline-code KDF probe EAS profile is not the exact internal physical-device profile.");
for (const required of ["createOfflineCodeV2KdfEvidenceRunner", "createOfflineCodeV2PlatformProofProducer",
  "OFFLINE_CODE_V2_KDF_PROBE_FIXTURE", "sampleCount: 5", "production_runtime: false",
  "report.production_approved"])
  if (!host.includes(required)) throw new Error(`Offline-code KDF probe host is missing ${required}.`);
for (const token of ["fetch(", "axios", "@supabase", "SecureStore", "AsyncStorage", "storage.from",
  "Authorization", "Cookie", "durations_ms", "synthetic_client_secret.secret", ".salt", ".root",
  ".signature", ".device.model", ".device.osVersion", "production_approved: true"])
  if (host.includes(token)) throw new Error(`Offline-code KDF probe host contains forbidden behavior: ${token}`);
for (const token of ["synthetic_proof_private_key", "proof_seed", "wrap_key", "associated_data",
  "ciphertext", "mek", "possession_proof", "challenge_canonical"])
  if (fixture.includes(token)) throw new Error(`Offline-code KDF probe fixture contains unnecessary material: ${token}`);
for (const file of productionFiles(join(mobile, "app"))) {
  const source = readFileSync(file, "utf8");
  if (source.includes("offline-code-v2-kdf-evidence-runner")
    || source.includes("offline-code-v2-proof-producer")
    || source.includes("offline-code-kdf-probe-app"))
    throw new Error(`Normal mobile runtime imports the KDF probe from ${relative(root, file)}.`);
}

function productionFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...productionFiles(path));
    else if (/\.(ts|tsx)$/u.test(entry)) output.push(path);
  }
  return output;
}
