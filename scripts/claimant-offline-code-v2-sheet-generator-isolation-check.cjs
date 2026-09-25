const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const generatorPath = "apps/mobile/src/features/claimant-offline-code/offline-code-v2-sheet-generator.ts";
const generator = readFileSync(join(root, generatorPath), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_SHEET_GENERATOR_APPROVED\s*=\s*false\s+as\s+const/u.test(generator))
  throw new Error("Offline-code V2 sheet generator approval must remain literal false.");
for (const token of ["input.syntheticOnly !== true", "OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID",
  "production_approved: false", "crypto.wipe(value)"])
  if (!generator.includes(token)) throw new Error(`Missing offline-code V2 sheet generator control: ${token}`);
for (const token of ["fetch(", "axios", "@supabase", "process.env", "SecureStore", "AsyncStorage", "localStorage",
  "sessionStorage", "console.", "Authorization", "production_approved: true", "Math.random", "require(", "import("])
  if (generator.includes(token)) throw new Error(`Offline-code V2 sheet generator contains forbidden behavior: ${token}`);
const imports = [...generator.matchAll(/from "([^"]+)"/gu)].map((match) => match[1]).sort();
if (JSON.stringify(imports) !== JSON.stringify(["./offline-code-v2-proof-core", "@vault/shared-types"]))
  throw new Error("Offline-code V2 sheet generator imports an unapproved module.");

for (const file of productionFiles(join(root, "apps"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (path === generatorPath || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
  if (readFileSync(file, "utf8").includes("offline-code-v2-sheet-generator"))
    throw new Error(`Offline-code V2 sheet generator is imported by ${path}.`);
}
console.log("Claimant offline-code V2 sheet generator isolation passed.");

function productionFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".expo", ".next", "dist"].includes(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...productionFiles(path));
    else if (/\.(ts|tsx|js|jsx)$/u.test(entry)) output.push(path);
  }
  return output;
}
