const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { extname, join } = require("node:path");

const root = join(__dirname, "..");
const webRoot = join(root, "apps", "web");
const coordinatorPath = join(webRoot, "lib", "claimant", "submission-coordinator.ts");
const coordinator = readFileSync(coordinatorPath, "utf8");
const portal = readFileSync(join(webRoot, "lib", "claimant-portal.ts"), "utf8");

requireMatch(coordinator, /CLAIMANT_SUBMISSION_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/u,
  "Claimant submission coordinator must remain hard-disabled.");
requireMatch(portal, /claimIntake:\s*false/u,
  "Claimant portal intake/submission capability must remain false.");
for (const token of ["createIdempotencyKey", "hasPendingRetry", "retry_required", "exactKeys",
  "release_authorized", "review_started", "runtime_submission_authorized"]) {
  if (!coordinator.includes(token)) throw new Error(`Submission coordinator lost boundary token: ${token}`);
}
for (const token of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage",
  "sessionStorage", "indexedDB", "document.cookie", "CacheStorage", "navigator.serviceWorker",
  "@supabase", "@aws-sdk", "@google-cloud", "@azure/storage", "notification", "provider_token",
  "reviewer_id", "owner_response", "fraud_signal", "risk_score", "internal_note", "private_key"]) {
  if (coordinator.includes(token)) {
    throw new Error(`Claimant submission coordinator contains forbidden token: ${token}`);
  }
}
for (const path of sourceFiles(webRoot)) {
  if (path === coordinatorPath || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  if (readFileSync(path, "utf8").includes("submission-coordinator")) {
    throw new Error(`Web runtime source imports the disconnected submission coordinator: ${path}`);
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
