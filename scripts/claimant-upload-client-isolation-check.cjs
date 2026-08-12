const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { extname, join } = require("node:path");

const root = join(__dirname, "..");
const webRoot = join(root, "apps", "web");
const coordinatorPath = join(webRoot, "lib", "claimant", "evidence-upload-coordinator.ts");
const portalPath = join(webRoot, "lib", "claimant-portal.ts");
const coordinator = readFileSync(coordinatorPath, "utf8");
const portal = readFileSync(portalPath, "utf8");

requireMatch(coordinator,
  /CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/u,
  "Claimant evidence-upload client coordinator must remain hard-disabled.");
requireMatch(portal, /evidenceUpload:\s*false/u,
  "The claimant portal evidence-upload capability must remain false.");
requireMatch(coordinator, /body:\s*Uint8Array/u,
  "The coordinator must retain its synthetic byte-body boundary.");
requireMatch(coordinator, /value\.body\.byteLength\s*!==\s*value\.placeholder\.size_bytes/u,
  "The coordinator must bind upload bytes to prepared placeholder size.");
requireMatch(coordinator, /value\.placeholder\.synthetic_only\s*!==\s*true/u,
  "The coordinator must reject non-synthetic evidence placeholders.");

for (const token of ["fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "indexedDB",
  "navigator.serviceWorker", "FormData", "FileReader", "showOpenFilePicker", "@aws-sdk",
  "@google-cloud", "@azure/storage", "supabase", "s3", "blob.core.windows.net"]) {
  if (coordinator.includes(token)) {
    throw new Error(`Claimant evidence-upload coordinator contains forbidden runtime token: ${token}`);
  }
}

for (const path of sourceFiles(webRoot)) {
  if (path === coordinatorPath || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  const source = readFileSync(path, "utf8");
  if (source.includes("evidence-upload-coordinator")) {
    throw new Error(`Web runtime source imports the disconnected upload coordinator: ${path}`);
  }
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const name of readdirSync(directory)) {
    if ([".next", "node_modules"].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) result.push(...sourceFiles(path));
    else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(path))) result.push(path);
  }
  return result;
}
