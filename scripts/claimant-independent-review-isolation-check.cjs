const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root, "services/api/src/claimant/independent-review-service.ts"), "utf8");
const client = readFileSync(join(root, "services/api/src/claimant/independent-review-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_INDEPENDENT_REVIEW_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Independent-review approval must remain literal false.");
if (index.includes("independent-review-service") || index.includes("independent-review-transaction-client"))
  throw new Error("Independent-review foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "evidence_bytes", "signed_url",
  "release_package", "authorize_release", "sendEmail", "resend", "postmark", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Independent-review boundary contains forbidden token: ${token}`);
