const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-service.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

if (!/CLAIMANT_OWNER_PROTECTION_APPROVED\s*=\s*false\s+as\s+const/u.test(service)) {
  throw new Error("Owner-protection service approval must remain literal false.");
}
if (index.includes("owner-protection-service") || index.includes("owner-protection-transaction-client")) {
  throw new Error("Owner-protection foundation must remain unmounted.");
}
for (const token of ["fetch(", "process.env", "sendEmail", "resend", "postmark", "mailgun",
  "twilio", "reviewer_id", "owner_response", "release_package", "private_key"]) {
  if (service.includes(token)) throw new Error(`Owner-protection service contains forbidden token: ${token}`);
}
