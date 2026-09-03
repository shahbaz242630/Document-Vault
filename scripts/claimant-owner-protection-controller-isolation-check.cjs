const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const controller = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-controller.ts"), "utf8");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-service.ts"), "utf8");
const transaction = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

requireMatch(controller, /CLAIMANT_OWNER_PROTECTION_CONTROLLER_APPROVED\s*=\s*false\s+as\s+const/u,
  "Owner-protection controller approval must remain literal false.");
requireMatch(service, /CLAIMANT_OWNER_PROTECTION_APPROVED\s*=\s*false\s+as\s+const/u,
  "Owner-protection service approval must remain literal false.");
requireMatch(controller, /requireClaimantCapability\([^;]+"ownerProtection"\)/u,
  "Owner-protection controller must retain its runtime capability gate.");
for (const token of ["requireFreshClaimantAssurance", ".ownerSession.assertActiveSession(",
  ".portal.assert(", "new URL(context.req.url).origin === apiOrigin", "MAX_BODY_BYTES = 4_096",
  "actorUserId: session.userId", 'reason: prepared.action === "ownerCancel"',
  '"owner_cancelled" : "claimant_dispute"', "Idempotency-Key", "Retry-After",
  "Cache-Control", "X-Content-Type-Options"]) {
  if (!controller.includes(token)) throw new Error(`Owner-protection controller lost boundary token: ${token}`);
}
for (const path of ["/owner/cases/:caseId/protection/cancel",
  "/claimant/cases/:caseId/protection/dispute", "createOwnerProtectionControllerV1",
  "createOwnerProtectionPreflightControllerV1"]) {
  if (!index.includes(path)) throw new Error(`Concealed owner-protection route is missing: ${path}`);
}
requireMatch(controller,
  /action === "ownerCancel"[\s\S]*?createOwnerSessionClient[\s\S]*?: \{ \.\.\.common, action, portal:/u,
  "Owner and claimant routes must instantiate only their respective session authority.");
requireMatch(transaction, /releaseAuthorized:\s*false/u,
  "Owner-protection transaction output must retain a literal false release type.");
requireMatch(transaction, /reviewStarted:\s*false/u,
  "Owner-protection transaction output must retain a literal false review type.");
for (const token of ["console.", "owner_email", "owner_phone", "recipient_address", "sendEmail",
  "resend", "postmark", "mailgun", "twilio", "provider_token", "provider_secret",
  "reviewer_id", "risk_score", "fraud_signal", "internal_note"]) {
  if (controller.includes(token)) throw new Error(`Owner-protection controller contains forbidden token: ${token}`);
}
if (index.includes("owner-protection-service") || index.includes("owner-protection-transaction-client")) {
  throw new Error("API entrypoint must mount only the concealed owner-protection controller boundary.");
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}
