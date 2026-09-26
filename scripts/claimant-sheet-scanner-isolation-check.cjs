const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const feature = "apps/mobile/src/features/claimant-journey";
const read = (path) => readFileSync(join(root, path), "utf8");
const files = {
  scan: `${feature}/claim-sheet-scan.ts`,
  scanner: `${feature}/claim-sheet-scanner.tsx`,
  scannerView: `${feature}/claim-sheet-scanner-view-model.ts`,
  panel: `${feature}/claim-flow-panel.tsx`,
  panelView: `${feature}/claim-flow-view-model.ts`,
};
const sources = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, read(path)]));

// Slice 6I: the camera scans QR codes only, hands one sheet to the claim flow and keeps nothing.
for (const [name, token] of [
  ["scan", 'result.type !== "qr"'], ["scan", "OFFLINE_CODE_V2_SHEET_MAX_LENGTH"],
  ["scan", "startsWith(OFFLINE_CODE_V2_SHEET_PREFIX)"], ["scan", "done = true;"],
  ["scanner", 'barcodeScannerSettings={{ barcodeTypes: ["qr"] }}'], ["scanner", "onBarcodeScanned={scan.onScan}"],
  ["scanner", 'view.stage === "camera"'], ["scanner", "scan.close()"], ["scanner", "useIsFocused()"],
  ["scanner", 'AppState.addEventListener("change"'], ["panel", "usePreventScreenCapture()"],
  ["panel", "setScanning(false);\n    void flow.submit(sheetText);"], ["panel", "view.scanLabel && scanning"],
]) if (!sources[name].includes(token)) throw new Error(`Claim sheet scanner lost control in ${name}: ${token}`);

// No capture, recording, storage, clipboard, logging or free text entry anywhere on the claim screen.
for (const [name, source] of Object.entries(sources))
  for (const token of ["takePictureAsync", "recordAsync", "launchScanner", "scanFromURLAsync", "MediaLibrary",
    "expo-media-library", "expo-image-picker", "SecureStore", "AsyncStorage", "localStorage", "sessionStorage",
    "expo-file-system", "Clipboard", "console.", "TextInput", "TextAreaField", "onChangeText", "import("])
    if (source.includes(token)) throw new Error(`Claim sheet scanner ${name} contains forbidden behavior: ${token}`);

// The scanned value goes only to the flow; it is never put in state, props other than the handler, or text.
if (/useState\([^)]*sheet/iu.test(sources.panel) || /\bdata\b/u.test(sources.panel))
  throw new Error("The claim screen must not keep the scanned sheet.");

// Camera only: no microphone or audio permission.
const app = JSON.parse(read("apps/mobile/app.json")).expo;
const camera = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera");
if (!camera || camera[1].microphonePermission !== false || camera[1].recordAudioAndroid !== false
  || typeof camera[1].cameraPermission !== "string")
  throw new Error("The camera plugin must request the camera only, with its own explanation.");

// Only the scanner opens the camera, and only the claim screen renders the scanner.
for (const file of sourceFiles(join(root, "apps/mobile"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (/\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("expo-camera") && path !== files.scanner)
    throw new Error(`Only the claim sheet scanner may use the camera: ${path}`);
  if (source.includes("./claim-sheet-scanner\"") && path !== files.panel)
    throw new Error(`Only the claim screen may render the sheet scanner: ${path}`);
}

console.log("Claimant sheet scanner isolation passed.");

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
