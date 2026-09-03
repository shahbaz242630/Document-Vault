const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-completion-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-completion-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_RETRIEVAL_COMPLETION_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Retrieval completion approval must remain literal false.");
if (index.includes("retrieval-completion-service") ||
    index.includes("retrieval-completion-transaction-client"))
  throw new Error("Retrieval completion must remain unmounted.");
for (const token of ["fetch(", "process.env", "storage.from", "decrypt", "plaintext",
  "assertion_object", "publicKeySpki", "private_key", "sendEmail", "twilio", "/routes/"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Retrieval completion contains forbidden direct behavior: ${token}`);
if (!/sha256\(proof\.nativeOpenSessionReference\)/u.test(service))
  throw new Error("The opaque native open reference must be reduced to a digest.");
if (!/export_performed: z\.literal\(false\)/u.test(client)
  || !/closure_recorded: z\.literal\(false\)/u.test(client))
  throw new Error("Export and closure must remain false.");
