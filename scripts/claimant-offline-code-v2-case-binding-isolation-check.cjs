const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const servicePath = join(root,
  "services/api/src/claimant/offline-code-v2-case-binding-service.ts");
const clientPath = join(root,
  "services/api/src/claimant/offline-code-v2-case-binding-transaction-client.ts");
const migrationPath = join(root,
  "supabase/migrations/20260902180000_claimant_offline_code_v2_case_binding.sql");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");
const service = readFileSync(servicePath, "utf8");
const client = readFileSync(clientPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Offline-code V2 case binding approval must remain literal false.");
for (const moduleName of ["offline-code-v2-case-binding-service",
  "offline-code-v2-case-binding-transaction-client"])
  if (index.includes(moduleName)) throw new Error(`Offline-code V2 case binding is mounted: ${moduleName}`);
for (const [path, source] of [[servicePath, service], [clientPath, client]])
  for (const token of ["@supabase", "createClient", "fetch(", "process.env", "localStorage",
    "sessionStorage", "indexedDB", "storage.from", "sendEmail", "release_packages"])
    if (source.includes(token)) throw new Error(`Case binding has runtime coupling at ${path}: ${token}`);
for (const token of ["client_secret", "proof_private_key", "plaintext_mek", "root_secret",
  "wrap_key", "raw_locator", "normalized_locator"])
  if (migration.includes(token) || service.includes(token) || client.includes(token))
    throw new Error(`Case binding contains prohibited material: ${token}`);
if (!migration.includes("from public, anon, authenticated")
  || !migration.includes("to service_role"))
  throw new Error("Offline-code V2 case binding RPC is not service-only.");

console.log("Claimant offline-code V2 case binding isolation check passed.");
