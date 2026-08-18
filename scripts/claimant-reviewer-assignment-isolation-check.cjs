const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "reviewer-assignment-service.ts"), "utf8");
const client = readFileSync(join(root, "services", "api", "src", "claimant",
  "reviewer-assignment-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

if (!/CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED\s*=\s*false\s+as\s+const/u.test(service)) {
  throw new Error("Reviewer-assignment approval must remain literal false.");
}
if (index.includes("reviewer-assignment-service")
  || index.includes("reviewer-assignment-transaction-client")) {
  throw new Error("Reviewer-assignment foundation must remain unmounted.");
}
for (const token of ["fetch(", "process.env", "localStorage", "document.", "window.",
  "evidence_object", "evidence_access", "record_review_decision", "release_package",
  "authorize_release", "sendEmail", "resend", "postmark", "twilio"]) {
  if (service.includes(token) || client.includes(token)) {
    throw new Error(`Reviewer-assignment boundary contains forbidden token: ${token}`);
  }
}
