const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

// Staging wiring W2a: the claimant "check a sheet" screen, in the Preview build only. It runs one possession check
// through the offline-code V2 chain, shows only the outcome, keeps nothing and never reaches a claim.
const root = join(__dirname, "..");
const files = {
  route: "apps/mobile/app/claim/check-sheet.tsx",
  panel: "apps/mobile/src/features/claimant-journey/sheet-check-panel.tsx",
  flow: "apps/mobile/src/features/claimant-journey/sheet-check-flow.ts",
  runtime: "apps/mobile/src/features/claimant-offline-code/sheet-check-runtime.ts",
};
const chain = {
  "apps/mobile/src/features/claimant-offline-code/offline-code-v2-lifecycle.ts": "CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED",
  "apps/mobile/src/features/claimant-offline-code/offline-code-v2-coordinator.ts":
    "CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED",
  "apps/mobile/src/features/claimant-offline-code/offline-code-v2-transport.ts": "CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED",
  "apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-core.ts": "CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED",
};

function validateSheetCheckSources(sources) {
  const source = (path) => {
    const value = sources.get(path);
    if (typeof value !== "string") throw new Error(`Claimant sheet check is missing ${path}`);
    return value;
  };
  const [route, panel, flow, runtime] = [files.route, files.panel, files.flow, files.runtime].map(source);

  // The chain keeps its own literal-false approvals; only the runtime opens it, and only for the Preview build.
  for (const [path, flag] of Object.entries(chain))
    if (!source(path).includes(`export const ${flag} = false as const;`))
      throw new Error(`Offline-code V2 approval must remain literal false: ${flag}`);
  for (const token of [
    "const approved = input.approved ?? (CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED || isClaimantPreviewBuild());",
    "if (!approved) return null;", "if (!isClaimantPreviewBuild()) return null;",
    "createOfflineCodeV2PlatformProofProducer(approved)", "approved: input.approved, syntheticOnly: true,",
    "productionRuntime: false,", "EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN",
    "apiOrigin === claimantOrigin"])
    if (!runtime.includes(token)) throw new Error(`Claimant sheet check runtime lost its Preview gate: ${token}`);
  if ((runtime.match(/approved: true/gu) ?? []).length) throw new Error("Claimant sheet check must not hard-open the chain.");
  if (runtime.indexOf("if (!approved) return null;") > runtime.indexOf("getApiEnv(input.env)"))
    throw new Error("Claimant sheet check must close before reading configuration.");

  // The route reaches only the panel; the panel reaches only the handle, the pure flow and the 6I scanner.
  const imports = (text) => [...text.matchAll(/from "([^"]+)"/gu)].map((match) => match[1]);
  if (JSON.stringify(imports(route)) !== JSON.stringify(["@/features/claimant-journey/sheet-check-panel", "@/shared/ui"]))
    throw new Error("The check-sheet route must reach only the sheet check panel.");
  if (JSON.stringify(imports(panel).sort()) !== JSON.stringify(["./claim-sheet-scanner", "./sheet-check-flow",
    "@/features/claimant-offline-code/sheet-check-runtime", "@/shared/ui", "expo-screen-capture", "react",
    "react-native"])) throw new Error("The sheet check panel reaches past its handle.");
  if (JSON.stringify(imports(flow)) !== JSON.stringify(["@vault/shared-types"]))
    throw new Error("The sheet check flow must stay pure.");
  for (const token of ["usePreventScreenCapture();", "setScanning(false);\n    void flow.submit(sheetText);",
    "useEffect(() => () => flow.dispose(), [flow]);", "view.scanLabel && scanning"])
    if (!panel.includes(token)) throw new Error(`Claimant sheet check panel lost control: ${token}`);
  for (const token of ['if (!port || disposed || status !== "ready") return;', "finally { attempt = null; }",
    "if (disposed || generation !== started) return;", "input.port.cancel();", "input.port?.dispose()",
    '"This sheet is valid"', '"This sheet can\'t be used"', '"Something went wrong, try again"'])
    if (!flow.includes(token)) throw new Error(`Claimant sheet check flow lost control: ${token}`);

  // Nothing is stored, logged, copied, typed or shown, and no claim, handoff or session is reachable.
  for (const [name, text] of Object.entries({ route, panel, flow, runtime })) {
    for (const token of ["SecureStore", "AsyncStorage", "localStorage", "sessionStorage", "FileSystem",
      "expo-file-system", "Clipboard", "console.", "TextInput", "onChangeText", "import(", "require(",
      "claimant-handoff", "claimant-session", "claim-flow", "runtime-bootstrap", "runtime-foundation",
      "runtime-launch-policy", "offline-code-v2-transport", "offline-code-v2-coordinator", "Authorization",
      "supabase", "useVaultSession"])
      if (text.includes(token)) throw new Error(`Claimant sheet check ${name} contains forbidden behavior: ${token}`);
  }
  if (/useState\([^)]*sheet/iu.test(panel) || /\bdata\b/u.test(panel) || /\{sheetText\}/u.test(panel))
    throw new Error("The sheet check screen must not keep or show the scanned sheet.");
  for (const token of ["publicLocator", "clientSecret", "recordBinding", "challenge_id", "locator_record_id"])
    if (flow.includes(token) || panel.includes(token)) throw new Error(`The sheet check keeps or shows sheet material: ${token}`);

  // Only this route renders the panel, only the Emergency access route reaches the handle besides the panel.
  for (const [path, text] of sources) {
    if (/\.test\.[cm]?[jt]sx?$/u.test(path) || !path.startsWith("apps/mobile/")) continue;
    if (text.includes("sheet-check-panel") && path !== files.route)
      throw new Error(`Only the check-sheet route may render the sheet check panel: ${path}`);
    if (text.includes("sheet-check-runtime") && path !== files.panel && path !== "apps/mobile/app/settings/emergency-access.tsx")
      throw new Error(`The sheet check handle is reached outside its screen and entry: ${path}`);
    if (path.startsWith("apps/mobile/app/") && /sheet-check-(flow|runtime)"/u.test(text)
      && path !== "apps/mobile/app/settings/emergency-access.tsx")
      throw new Error(`Route ${path} reaches past the sheet check panel.`);
  }
  const entry = source("apps/mobile/app/settings/emergency-access.tsx");
  if (!entry.includes("onCheckEmergencySheet={sheetCheck\n") || /sheetCheck\.open|sheetCheck\?\.open/u.test(entry))
    throw new Error("The Emergency access entry must show only while the sheet check handle exists.");
}

function collectSources(base = root) {
  const sources = new Map();
  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      if (["node_modules", ".expo", "dist", "android", "ios"].includes(entry)) continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/u.test(entry)) sources.set(relative(base, path).replaceAll("\\", "/"), readFileSync(path, "utf8"));
    }
  };
  walk(join(base, "apps/mobile"));
  return sources;
}

module.exports = { files, collectSources, validateSheetCheckSources };
if (require.main === module) {
  validateSheetCheckSources(collectSources());
  console.log("Claimant sheet check isolation passed.");
}
