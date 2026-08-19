const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const servicePath = join(root, "services/api/src/claimant/offline-code-v2-persistence-service.ts");
const clientPath = join(root,
  "services/api/src/claimant/offline-code-v2-persistence-transaction-client.ts");
const migrationPath = join(root,
  "supabase/migrations/20260819080343_claimant_offline_code_v2_persistence.sql");
const indexPath = join(root, "services/api/src/index.ts");
const service = readFileSync(servicePath, "utf8");
const client = readFileSync(clientPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const index = readFileSync(indexPath, "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Offline-code V2 persistence approval must remain literal false.");
for (const moduleName of ["offline-code-v2-persistence-service",
  "offline-code-v2-persistence-transaction-client"])
  if (index.includes(moduleName)) throw new Error(`Offline-code V2 persistence is mounted: ${moduleName}`);
for (const [path, source] of [[servicePath, service], [clientPath, client]]) {
  for (const token of ["@supabase", "createClient", "fetch(", "process.env", "localStorage",
    "sessionStorage", "indexedDB", "storage.from", "sendEmail", "release_packages"])
    if (source.includes(token)) throw new Error(`Persistence boundary has runtime coupling at ${path}: ${token}`);
}
for (const token of ["raw_locator", "normalized_locator", "p_client_secret", "clientSecret",
  "proof_private_key", "plaintext_mek", "root_secret"])
  if (migration.includes(token) || service.includes(token) || client.includes(token))
    throw new Error(`Offline-code V2 persistence contains prohibited material: ${token}`);

console.log("Claimant offline-code V2 persistence isolation check passed.");
