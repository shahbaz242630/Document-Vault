const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const routesPath = "services/api/src/claimant/offline-code-v2-owner-routes.ts";
const indexerPath = "services/api/src/claimant/offline-code-v2-locator-index.ts";
const routes = readFileSync(join(root, routesPath), "utf8");
const controller = readFileSync(join(root, "services/api/src/claimant/offline-code-v2-controller.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED\s*=\s*false\s+as\s+const/u.test(routes))
  throw new Error("Offline-code V2 owner routes approval must remain literal false.");
for (const token of ['requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "offlineCodeV2")',
  "requireFreshClaimantAssurance", "assertActiveSession(session.userId, session.sessionId)",
  "ownerUserId: session.userId", "owner_id: ownerUserId", "z.strictObject", 'reason: "owner_revoked"',
  "new URL(context.req.url).origin === config.apiOrigin", "ownerOrigin === claimantOrigin",
  "offlineCodeV2BoundaryDigest(", '"locator", registration.normalizedLocator'])
  if (!routes.includes(token)) throw new Error(`Offline-code V2 owner routes lost boundary: ${token}`);
for (const token of ["body.ownerUserId", "console.", "createHmac", "process.env.NODE_ENV", "localStorage",
  "claimCreated: true", "releaseAuthorized: true", "production_approved: true", "apps/mobile", "import("])
  if (routes.includes(token)) throw new Error(`Offline-code V2 owner routes contain prohibited behavior: ${token}`);
if (!controller.includes("offline-code-v2-locator-index.js") || controller.includes("createHmac"))
  throw new Error("Offline-code V2 challenge route must derive the locator index from the shared module.");

// One locator-index derivation: only the shared module may hold the boundary HMAC label.
for (const file of sourceFiles(join(root, "services"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (path === indexerPath || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
  if (readFileSync(file, "utf8").includes("sanduqkin:claim:offline-code:v2:boundary"))
    throw new Error(`Offline-code V2 locator-index derivation is duplicated in ${path}.`);
}

for (const token of ['"/owner/offline-code/v2/locators"', '"/owner/offline-code/v2/locators/:locatorRecordId/revoke"',
  "createOfflineCodeV2OwnerRoute", "createOfflineCodeV2OwnerPreflightRoute"])
  if (!index.includes(token)) throw new Error(`Offline-code V2 owner route is missing: ${token}`);

console.log("Claimant offline-code V2 owner routes isolation check passed.");

function sourceFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", "dist", "coverage"].includes(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...sourceFiles(path));
    else if (/\.(ts|tsx|js|cjs|mjs)$/u.test(entry)) output.push(path);
  }
  return output;
}
