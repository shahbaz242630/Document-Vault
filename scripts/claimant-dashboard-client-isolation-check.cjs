const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { extname, join } = require("node:path");

const root = join(__dirname, "..");
const webRoot = join(root, "apps", "web");
const coordinatorPath = join(webRoot, "lib", "claimant", "dashboard-read-model-coordinator.ts");
const coordinator = readFileSync(coordinatorPath, "utf8");
const portal = readFileSync(join(webRoot, "lib", "claimant-portal.ts"), "utf8");

requireMatch(coordinator,
  /CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/u,
  "Claimant dashboard read-model coordinator must remain hard-disabled.");
requireMatch(portal, /dashboard:\s*false/u,
  "Claimant portal dashboard capability must remain false.");
for (const token of ["canonicalProjectionTriplets", "projection_version < previous.projection_version",
  "divergent_response", "last_meaningful_update_date", "secure_case_support", "synthetic_only"] ) {
  if (!coordinator.includes(token)) throw new Error(`Dashboard coordinator lost boundary token: ${token}`);
}
for (const token of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage",
  "sessionStorage", "indexedDB", "document.cookie", "CacheStorage", "navigator.serviceWorker",
  "@supabase", "@aws-sdk", "@google-cloud", "@azure/storage", "reviewer_id", "owner_response",
  "fraud_signal", "risk_score", "internal_note", "evidence_object", "release_package_id"]) {
  if (coordinator.includes(token)) {
    throw new Error(`Claimant dashboard coordinator contains forbidden token: ${token}`);
  }
}
for (const path of sourceFiles(webRoot)) {
  if (path === coordinatorPath || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  if (readFileSync(path, "utf8").includes("dashboard-read-model-coordinator")) {
    throw new Error(`Web runtime source imports the disconnected dashboard coordinator: ${path}`);
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
