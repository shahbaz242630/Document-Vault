const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const controller = readFileSync(join(root, "services", "api", "src", "claimant",
  "claim-submission-controller.ts"), "utf8");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "claim-submission-service.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

requireMatch(controller, /CLAIMANT_SUBMISSION_CONTROLLER_APPROVED\s*=\s*false\s+as\s+const/u,
  "Claim submission controller approval must remain literal false.");
requireMatch(service, /CLAIMANT_SUBMISSION_APPROVED\s*=\s*false\s+as\s+const/u,
  "Claim submission service approval must remain literal false.");
requireMatch(controller, /requireClaimantCapability\([^;]+"claimIntake"\)/u,
  "Claim submission controller must retain its claimant runtime capability gate.");
for (const token of ["requireFreshClaimantAssurance", ".portal.assert(",
  "new URL(context.req.url).origin === config.apiOrigin", "MAX_BODY_BYTES = 16_384",
  "Idempotency-Key", "Retry-After", "Cache-Control", "X-Content-Type-Options",
  "expectedIntakeVersion", "expectedPreparationVersion"]) {
  if (!controller.includes(token)) throw new Error(`Submission controller lost boundary token: ${token}`);
}
for (const path of ["/claimant/cases/:caseId/submissions", "createClaimSubmissionControllerV1",
  "createClaimSubmissionPreflightControllerV1"]) {
  if (!index.includes(path)) throw new Error(`Concealed submission route is missing: ${path}`);
}
for (const token of ["console.", "filename", "fileName", "object_path", "content_digest",
  "reviewer_id", "owner_response", "fraud_signal", "risk_score", "internal_note",
  "sendEmail", "resend", "postmark", "mailgun", "twilio"]) {
  if (controller.includes(token)) throw new Error(`Submission controller contains forbidden token: ${token}`);
}
if (index.includes("claim-submission-service") || index.includes("claim-submission-transaction-client")) {
  throw new Error("API entrypoint must mount only the concealed submission controller boundary.");
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}
