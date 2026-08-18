const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-session-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-session-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_RETRIEVAL_SESSION_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Retrieval-session approval must remain literal false.");
if (index.includes("retrieval-session-service") ||
    index.includes("retrieval-session-transaction-client"))
  throw new Error("Retrieval-session foundation must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "plaintext",
  "signed_url", "download", "storage.from", "decrypt", "sendEmail", "twilio"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Retrieval-session boundary contains forbidden token: ${token}`);
