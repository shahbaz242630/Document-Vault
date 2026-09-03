const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const controllerPath = join(root, "services/api/src/claimant/offline-code-v2-controller.ts");
const controller = readFileSync(controllerPath, "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED\s*=\s*false\s+as\s+const/u.test(controller))
  throw new Error("Offline-code V2 controller approval must remain literal false.");
for (const token of ["requireClaimantCapability", '"offlineCodeV2"', "getTrustedSignals",
  "MAX_BODY_BYTES = 16_384", "new URL(context.req.url).origin === config.apiOrigin",
  "context.req.header(\"Authorization\")", "context.req.header(\"Cookie\")",
  "locatorIndexKey === rateLimitKey"])
  if (!controller.includes(token)) throw new Error(`Offline-code V2 controller lost boundary: ${token}`);
for (const token of ["x-forwarded-for", "cf-connecting-ip", "true-client-ip", "remote-address",
  "identityVerified: true", "claimCreated: true", "releaseAuthorized: true",
  "localStorage", "sessionStorage", "indexedDB", "sendEmail", "release_packages"])
  if (controller.toLowerCase().includes(token.toLowerCase()))
    throw new Error(`Offline-code V2 controller contains prohibited authority: ${token}`);
for (const token of ["/claimant/offline-code/v2/challenges",
  "/claimant/offline-code/v2/challenges/:challengeId/proofs",
  "createOfflineCodeV2Controller", "createOfflineCodeV2PreflightController"])
  if (!index.includes(token)) throw new Error(`Offline-code V2 controller route is missing: ${token}`);

console.log("Claimant offline-code V2 controller isolation check passed.");
