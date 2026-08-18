const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const featureRoot = join(root, "apps/mobile/src/features/claimant-retrieval");
const coordinator = readFileSync(join(featureRoot, "native-local-export-coordinator.ts"), "utf8");
const adapter = readFileSync(join(featureRoot, "native-local-export-adapter.ts"), "utf8");
if (!/CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED\s*=\s*false\s+as\s+const/u.test(coordinator)
  || !/CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED\s*=\s*false\s+as\s+const/u.test(adapter))
  throw new Error("Native local export approvals must remain literal false.");
for (const token of ["fetch(", "axios", "supabase", "SecureStore", "FileSystem", "Sharing",
  "expo-modules-core", "NativeModules", "requireNativeModule", "localStorage", "storage.from"])
  if (coordinator.includes(token) || adapter.includes(token))
    throw new Error(`Native local export contains forbidden direct dependency: ${token}`);
for (const file of productionFiles(join(root, "apps/mobile"))) {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  if (relativePath.includes("/claimant-retrieval/") || relativePath.endsWith(".test.ts")) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("native-local-export-coordinator")
    || source.includes("native-local-export-adapter"))
    throw new Error(`Native local export is mounted by ${relativePath}.`);
}
for (const file of productionFiles(join(root, "apps/mobile/modules")))
  if (/\.(swift|kt)$/u.test(file) && readFileSync(file, "utf8").includes("exportOpenedPackageAsync"))
    throw new Error("Production native local-export behavior must remain absent.");

function productionFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (entry === "node_modules" || entry === ".expo") continue;
    if (statSync(path).isDirectory()) output.push(...productionFiles(path));
    else if (/\.(ts|tsx|swift|kt)$/u.test(entry)) output.push(path);
  }
  return output;
}
