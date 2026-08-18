const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/release-authorization-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/release-authorization-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_RELEASE_AUTHORIZATION_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Release-authorization approval must remain literal false.");
if (index.includes("release-authorization-service")
  || index.includes("release-authorization-transaction-client"))
  throw new Error("Release-authorization foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "evidence_bytes", "signed_url",
  "release_package", "retrieval_session", "sendEmail", "resend", "postmark", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Release-authorization boundary contains forbidden token: ${token}`);
