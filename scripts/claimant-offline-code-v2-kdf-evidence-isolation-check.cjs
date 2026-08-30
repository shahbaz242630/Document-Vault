const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const featureRoot = join(root, "apps/mobile/src/features/claimant-offline-code");
const runnerPath = join(featureRoot, "offline-code-v2-kdf-evidence-runner.ts");
const runner = readFileSync(runnerPath, "utf8");
if (!/CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED\s*=\s*false\s+as\s+const/u.test(runner))
  throw new Error("Offline-code V2 KDF evidence entry must remain literal false.");
for (const token of ["fetch(", "axios", "@supabase", "process.env", "SecureStore", "AsyncStorage",
  "localStorage", "sessionStorage", "storage.from", "Authorization", "Cookie",
  "production_approved: true", "result_class: \"approved\"", "production_ready"])
  if (runner.includes(token)) throw new Error(`Offline-code V2 KDF evidence contains forbidden behavior: ${token}`);
for (const file of productionFiles(join(root, "apps/mobile"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (file === runnerPath || path.includes("/claimant-offline-code/")
    || path.includes("/offline-code-kdf-probe-app/")
    || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  if (readFileSync(file, "utf8").includes("offline-code-v2-kdf-evidence-runner"))
    throw new Error(`Offline-code V2 KDF evidence is mounted by ${path}.`);
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
