const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/review-intervention-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/review-intervention-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_REVIEW_INTERVENTION_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Review-intervention approval must remain literal false.");
if (index.includes("review-intervention-service")
  || index.includes("review-intervention-transaction-client"))
  throw new Error("Review-intervention foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "evidence_bytes", "signed_url",
  "release_package", "authorize_release", "sendEmail", "resend", "postmark", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Review-intervention boundary contains forbidden token: ${token}`);
