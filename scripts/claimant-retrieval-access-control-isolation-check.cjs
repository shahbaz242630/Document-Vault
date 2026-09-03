const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-access-control-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-access-control-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_RETRIEVAL_ACCESS_CONTROL_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Retrieval access control approval must remain literal false.");
if (index.includes("retrieval-access-control-service")
  || index.includes("retrieval-access-control-transaction-client"))
  throw new Error("Retrieval access control must remain unmounted.");
for (const token of ["fetch(", "process.env", "storage.from", "decrypt", "plaintext",
  "publicKeySpki", "private_key", "sendEmail", "twilio", "/routes/"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Retrieval access control contains forbidden direct behavior: ${token}`);
for (const token of ["future_retrieval_authorized: z.literal(false)",
  "future_serving_authorized: z.literal(false)", "local_content_deleted: z.literal(false)",
  "local_content_recalled: z.literal(false)"])
  if (!client.includes(token)) throw new Error(`Missing immutable-safe result: ${token}`);
