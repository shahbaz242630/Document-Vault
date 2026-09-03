const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/signed-manifest-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/signed-manifest-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_SIGNED_MANIFEST_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Signed-manifest approval must remain literal false.");
if (index.includes("signed-manifest-service") || index.includes("signed-manifest-transaction-client"))
  throw new Error("Signed-manifest foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "private_key", "plaintext",
  "signed_url", "retrieval_session", "sendEmail", "resend", "postmark", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Signed-manifest boundary contains forbidden token: ${token}`);
