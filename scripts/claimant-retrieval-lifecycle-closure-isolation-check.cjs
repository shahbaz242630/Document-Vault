const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-lifecycle-closure-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-lifecycle-closure-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
if (!/CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Retrieval lifecycle closure approval must remain literal false.");
if (index.includes("retrieval-lifecycle-closure-service")
  || index.includes("retrieval-lifecycle-closure-transaction-client"))
  throw new Error("Retrieval lifecycle closure must remain unmounted.");
for (const token of ["fetch(", "process.env", "storage.from", "decrypt", "private_key",
  "sendEmail", "twilio", "/routes/"])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Retrieval lifecycle closure contains forbidden direct behavior: ${token}`);
for (const token of ["closure_recorded: z.literal(true)",
  "historical_completion_preserved: z.literal(true)",
  "historical_delivery_preserved: z.literal(true)",
  "local_content_deleted: z.literal(false)", "local_content_recalled: z.literal(false)"])
  if (!client.includes(token)) throw new Error(`Missing immutable-safe result: ${token}`);
