const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const paths = ["offline-code-v2-handoff-service.ts", "offline-code-v2-handoff-controller.ts",
  "offline-code-v2-handoff-transaction-client.ts"].map((name) => join(root,
  "services/api/src/claimant", name));
const sources = paths.map((path) => [path, readFileSync(path, "utf8")]);
const migration = readFileSync(join(root,
  "supabase/migrations/20260903075258_claimant_offline_code_v2_authenticated_handoff.sql"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (index.includes("offline-code-v2-handoff")) throw new Error("Authenticated handoff is mounted.");
for (const [path, source] of sources)
  for (const token of ["@supabase", "createClient", "process.env", "localStorage", "sessionStorage",
    "indexedDB", "storage.from", "sendEmail", "release_packages"])
    if (source.includes(token)) throw new Error(`Authenticated handoff has runtime coupling at ${path}: ${token}`);
for (const token of ["proof_private_key", "client_secret", "plaintext_mek", "root_secret", "wrap_key"])
  if (migration.includes(token) || sources.some(([, source]) => source.includes(token)))
    throw new Error(`Authenticated handoff contains prohibited material: ${token}`);
if (!migration.includes("force row level security") || !migration.includes("to service_role"))
  throw new Error("Authenticated handoff persistence is not server-only.");

console.log("Claimant offline-code V2 authenticated handoff isolation check passed.");
