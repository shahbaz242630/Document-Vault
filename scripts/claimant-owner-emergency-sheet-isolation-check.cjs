const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const feature = "apps/mobile/src/features/claimant-offline-code";
const read = (path) => readFileSync(join(root, path), "utf8");
const files = {
  factory: `${feature}/owner-offline-code-sheet-factory.ts`,
  client: `${feature}/owner-offline-code-client.ts`,
  flow: `${feature}/owner-sheet-flow.ts`,
  html: `${feature}/owner-sheet-html.ts`,
  runtime: `${feature}/owner-sheet-runtime.ts`,
  viewModel: `${feature}/owner-sheet-view-model.ts`,
  panel: `${feature}/owner-emergency-sheet-panel.tsx`,
  listFlow: `${feature}/owner-sheet-list-flow.ts`,
  listView: `${feature}/owner-sheet-list-view-model.ts`,
  listPanel: `${feature}/owner-sheet-list-panel.tsx`,
  reference: `${feature}/owner-sheet-reference.ts`,
  launch: `${feature}/owner-sheet-launch.ts`,
};
const sources = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, read(path)]));

if (!/OWNER_OFFLINE_CODE_SHEET_APPROVED\s*=\s*false\s+as\s+const/u.test(sources.factory))
  throw new Error("Owner emergency sheet approval must remain literal false.");
if (!/OWNER_SHEET_FLOW_LAUNCH_APPROVED\s*=\s*false\s+as\s+const/u.test(sources.launch))
  throw new Error("Owner emergency sheet launch approval must remain literal false.");
for (const [name, token] of [["factory", "checkOfflineCodeV2ReleaseWrap("], ["factory", "syntheticOnly: true"],
  ["runtime", "if (!(input.approved ?? ownerSheetsOpen())) return null;"],
  ["runtime", "if (!ownerSheetsOpen()) return null;"], ["panel", "usePreventScreenCapture()"],
  // W2a: the only other way in is the separate Sanduqkin Preview app, never anything looser.
  ["launch", "return OWNER_SHEET_FLOW_LAUNCH_APPROVED || isClaimantPreviewBuild();"],
  ["launch", "if (!ownerSheetsOpen()) return;"],
  ["factory", "input.approved ?? (OWNER_OFFLINE_CODE_SHEET_APPROVED || isClaimantPreviewBuild())"],
  ["panel", "flow.handleAppState(next)"], ["panel", "void flow.abandon()"], ["client", "Idempotency-Key"],
  ["runtime", "export function createOwnerSheetListHandle"], ["listPanel", "useOwnerSheetListHandle()"],
  ["listPanel", "return () => flow.close();"], ["listFlow", "await deps.client.revoke(selected, revokeKey, signal)"],
  ["html", "ownerSheetReference(sheet.registration.locatorRecordId)"]])
  if (!sources[name].includes(token)) throw new Error(`Owner emergency sheet lost control in ${name}: ${token}`);

const listHandle = sources.runtime.slice(sources.runtime.indexOf("export function createOwnerSheetListHandle"));
if (!listHandle.includes("if (!(input.approved ?? ownerSheetsOpen())) return null;"))
  throw new Error("The owner sheet list must sit behind the owner sheet launch approval.");
// The list screen shows dates, status and references only; it never reaches the sheet, crypto or printer.
for (const name of ["listFlow", "listView", "listPanel"])
  for (const token of ["printedSecret", "sheetPayload", "printAsync", "createSheet", "proof-producer", "generator"])
    if (sources[name].includes(token)) throw new Error(`Owner sheet ${name} reaches sheet material: ${token}`);

// No storage, logging, files or sharing: the sheet exists only in memory and in the print dialog.
for (const [name, source] of Object.entries(sources))
  for (const token of ["SecureStore", "AsyncStorage", "localStorage", "sessionStorage", "expo-file-system",
    "FileSystem", "printToFileAsync", "shareAsync", "expo-sharing", "Share.share", "Clipboard", "console.",
    "Math.random", "production_approved: true", "import("])
    if (source.includes(token)) throw new Error(`Owner emergency sheet ${name} contains forbidden behavior: ${token}`);

// The vault key enters only through the vault session and never crosses into the flow, client or screen.
const session = read("apps/mobile/src/features/vault/vault-session.ts");
if (!/createOwnerOfflineCodeSheet\(\{[^}]*mek: key,[^}]*\}\)/su.test(session))
  throw new Error("The vault session must pass its own key to the owner sheet factory.");
for (const name of ["client", "flow", "html", "runtime", "viewModel", "panel", "listFlow", "listView", "listPanel",
  "reference", "launch"])
  if (/\bmek\b|masterKey|vaultKey/u.test(sources[name]))
    throw new Error(`Owner emergency sheet ${name} must never handle the vault key.`);

const factoryImporters = [];
for (const file of sourceFiles(join(root, "apps/mobile"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (/\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("createOwnerOfflineCodeSheet(") && path !== files.factory) factoryImporters.push(path);
  if (path.startsWith("apps/mobile/app/")) {
    for (const token of ["owner-offline-code-sheet-factory", "owner-offline-code-client", "owner-sheet-flow\"",
      "offline-code-v2-sheet-generator", "offline-code-v2-proof", "qrcode-generator", "expo-print"])
      if (source.includes(token)) throw new Error(`Route ${path} reaches past the owner sheet handle: ${token}`);
  }
}
if (JSON.stringify(factoryImporters) !== JSON.stringify(["apps/mobile/src/features/vault/vault-session.ts"]))
  throw new Error(`Only the vault session may create owner sheets: ${factoryImporters.join(", ")}`);

// W2a: the Preview-build gate reads exactly the inlined switch and the Preview app marker.
const previewGate = read("apps/mobile/src/shared/config/claimant-preview-build.ts");
for (const token of ['CLAIMANT_PREVIEW_BUILD_VALUE = "synthetic-only" as const',
  "flag: process.env.EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD,",
  "return signals.flag === CLAIMANT_PREVIEW_BUILD_VALUE && signals.extra?.claimantPreviewBuild === true;"])
  if (!previewGate.includes(token)) throw new Error(`Claimant Preview build gate lost condition: ${token}`);
const appConfig = read("apps/mobile/app.config.js");
for (const token of ['const CLAIMANT_PREVIEW_ID = "com.sanduqkin.mobile.claimantpreview";',
  "if (process.env.EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD && !isClaimantPreview) {",
  'if (isClaimantPreview && process.env.EAS_BUILD_PROFILE === "production") {',
  "claimantPreviewBuild: isClaimantPreview,"])
  if (!appConfig.includes(token)) throw new Error(`Claimant Preview app identity lost: ${token}`);

console.log("Claimant owner emergency sheet isolation passed.");

function sourceFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".expo", "dist", "android", "ios"].includes(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/u.test(entry)) output.push(path);
  }
  return output;
}
