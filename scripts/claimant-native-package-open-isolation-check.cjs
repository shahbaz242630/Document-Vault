const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const featureRoot = join(root, "apps/mobile/src/features/claimant-retrieval");
const coordinator = readFileSync(join(featureRoot, "native-package-open-coordinator.ts"), "utf8");
const adapter = readFileSync(join(featureRoot, "native-package-open-adapter.ts"), "utf8");
if (!/CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED\s*=\s*false\s+as\s+const/u.test(coordinator)
  || !/CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED\s*=\s*false\s+as\s+const/u.test(adapter))
  throw new Error("Native package opening approvals must remain literal false.");
for (const token of ["fetch(", "axios", "supabase", "SecureStore", "FileSystem",
  "expo-modules-core", "NativeModules", "requireNativeModule", "localStorage", "storage.from"])
  if (coordinator.includes(token) || adapter.includes(token))
    throw new Error(`Native package opening contains forbidden direct dependency: ${token}`);
for (const file of productionFiles(join(root, "apps/mobile"))) {
  const relativePath = relative(root, file).replaceAll("\\", "/");
  if (relativePath.includes("/claimant-retrieval/") || relativePath.endsWith(".test.ts")) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("native-package-open-coordinator") || source.includes("native-package-open-adapter"))
    throw new Error(`Native package opening is mounted by ${relativePath}.`);
}
for (const file of productionFiles(join(root, "apps/mobile/modules")))
  if (file.endsWith(".swift") && readFileSync(file, "utf8").includes("verifyAndOpenPackageAsync"))
    throw new Error("Production Swift package-opening behavior must remain absent.");

function productionFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (entry === "node_modules" || entry === ".expo") continue;
    if (statSync(path).isDirectory()) output.push(...productionFiles(path));
    else if (/\.(ts|tsx|swift)$/u.test(entry)) output.push(path);
  }
  return output;
}
