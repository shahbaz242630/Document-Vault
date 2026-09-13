const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const moduleRoot = join(root, "packages/shared-types/src/claim/offline-code");
const protocol = readFileSync(join(moduleRoot, "protocol.ts"), "utf8");

if (!/OFFLINE_CODE_V2_PROTOCOL_APPROVED\s*=\s*false\s+as\s+const/u.test(protocol)) {
  throw new Error("Offline-code V2 protocol approval must remain literal false.");
}

for (const path of collect(moduleRoot)) {
  const source = readFileSync(path, "utf8");
  for (const token of [
    "@supabase", "fetch(", "process.env", "localStorage", "sessionStorage",
    "indexedDB", "storage.from", "sendEmail", "notification_outbox", "release_packages",
  ]) {
    if (source.includes(token)) throw new Error(`Offline-code V2 shared protocol contains forbidden runtime behavior: ${token}`);
  }
}

const runtimeRoots = [join(root, "apps/mobile"), join(root, "apps/web"), join(root, "services/api/src")];
const runtimeOnlySymbols = [
  "OFFLINE_CODE_V2_PROTOCOL_APPROVED",
  "assertOfflineCodeProtocolBundleV2",
  "normalizeOfflineCodeClientSecretV2",
  "normalizeOfflineCodePublicLocatorV2",
  "OfflineCodeClientSecretV2",
  "OfflineCodePossessionProofV2",
  "OfflineCodeProtocolBundleV2",
  "OfflineCodePublicLocatorV2",
  "OfflineCodeRecordBindingV2",
];
for (const runtimeRoot of runtimeRoots) {
  for (const path of collect(runtimeRoot)) {
    if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
    if (path.includes("claimant-offline-code")
      || path.endsWith("offline-code-v2-challenge-coordinator.ts")
      || path.endsWith("offline-code-v2-proof-attempt-coordinator.ts")) continue;
    const source = readFileSync(path, "utf8");
    for (const symbol of runtimeOnlySymbols) {
      if (source.includes(symbol)) throw new Error(`Offline-code V2 protocol is wired into normal runtime at ${path}: ${symbol}`);
    }
  }
}

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    if (!entry.isFile() || (!path.endsWith(".ts") && !path.endsWith(".tsx"))) return [];
    return [path];
  });
}

module.exports = { collect };
