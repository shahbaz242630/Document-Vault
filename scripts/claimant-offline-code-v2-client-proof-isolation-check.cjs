const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const featureRoot = join(root, "apps/mobile/src/features/claimant-offline-code");
const core = readFileSync(join(featureRoot, "offline-code-v2-proof-core.ts"), "utf8");
const platform = readFileSync(join(featureRoot, "offline-code-v2-proof-producer.ts"), "utf8");
const native = readFileSync(join(featureRoot, "offline-code-v2-proof-producer.native.ts"), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED\s*=\s*false\s+as\s+const/u.test(core))
  throw new Error("Offline-code V2 client proof approval must remain literal false.");
if (!platform.includes('from "libsodium-wrappers-sumo"')
  || !native.includes('from "react-native-libsodium/src/lib.native"'))
  throw new Error("Offline-code V2 proof production must retain vetted platform crypto adapters.");
for (const token of ["fetch(", "axios", "@supabase", "process.env", "SecureStore", "AsyncStorage",
  "localStorage", "sessionStorage", "storage.from", "Authorization", "Cookie", "production_approved: true"])
  for (const source of [core, platform, native])
    if (source.includes(token)) throw new Error(`Offline-code V2 client proof contains forbidden runtime behavior: ${token}`);

for (const file of productionFiles(join(root, "apps/mobile"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (path.includes("/claimant-offline-code/") || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("offline-code-v2-proof-core") || source.includes("offline-code-v2-proof-producer"))
    throw new Error(`Offline-code V2 client proof is mounted by ${path}.`);
}

function productionFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".expo") continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...productionFiles(path));
    else if (/\.(ts|tsx)$/u.test(entry)) output.push(path);
  }
  return output;
}
