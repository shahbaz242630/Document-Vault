const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const coordinator = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-notice-delivery-coordinator.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

if (!/CLAIMANT_OWNER_NOTICE_DELIVERY_APPROVED\s*=\s*false\s+as\s+const/u.test(coordinator)) {
  throw new Error("Owner-notice delivery approval must remain literal false.");
}
if (index.includes("owner-notice-delivery-coordinator")) {
  throw new Error("Owner-notice delivery coordinator must remain unmounted.");
}
for (const token of ["createClient(", "fetch(", "process.env", "resend", "postmark", "mailgun",
  "twilio", "sendgrid", "owner_email", "owner_phone", "reviewer_id", "release_package",
  "private_key"]) {
  if (coordinator.includes(token)) throw new Error(`Delivery coordinator contains forbidden token: ${token}`);
}
for (const required of ["attemptNumber === 1", "provider.lookup", "deliveryEvidenceDigest",
  "reconciliation_required", "reviewStarted: false", "releaseAuthorized: false"]) {
  if (!coordinator.includes(required) && !readFileSync(join(root, "services", "api", "src",
    "claimant", "owner-protection-transaction-client.ts"), "utf8").includes(required)) {
    throw new Error(`Delivery coordinator is missing required control: ${required}`);
  }
}
