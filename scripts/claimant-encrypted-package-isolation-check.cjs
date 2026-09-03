const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_ENCRYPTED_PACKAGE_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Encrypted-package approval must remain literal false.");
if (index.includes("encrypted-package-service") || index.includes("encrypted-package-transaction-client"))
  throw new Error("Encrypted-package foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "decrypt", "private_key",
  "plaintext", "signed_url", "retrieval_session", "sendEmail", "resend", "postmark", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Encrypted-package boundary contains forbidden token: ${token}`);
