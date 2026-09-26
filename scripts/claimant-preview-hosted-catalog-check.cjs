// Staging wiring W1: read-only checks of the shared hosted Supabase database. It reads system catalogs and the
// migration history only, never table rows: every local migration must be applied, nothing unknown may be, and
// the same grant, row-level security and function rules the local catalog check enforces must hold.
const { readdirSync } = require("node:fs");
const { join } = require("node:path");

const { CATALOG_SQL, analyzeCatalog } = require("./supabase-db-security-check.cjs");

function compareMigrations(local, remote) {
  const remoteSet = new Set(remote);
  const localSet = new Set(local);
  return {
    missing: local.filter((version) => !remoteSet.has(version)),
    unknown: remote.filter((version) => !localSet.has(version)),
  };
}

// public.rls_auto_enable() is created on the hosted project by Supabase itself, not by a migration. Migration
// 20260819091516_harden_rls_auto_enable_execution revokes EXECUTE from every API role, so it is accepted only while
// neither anon nor authenticated can execute it.
function isHardenedPlatformFunction(violation, catalog) {
  if (violation.rule !== "public-function-no-security-definer" || violation.function !== "rls_auto_enable") return false;
  const grants = (catalog.functionPrivileges ?? []).filter((entry) => entry.functionName === "rls_auto_enable");
  return grants.length > 0 && grants.every((entry) => entry.hasPrivilege === false);
}

async function query(sql, { token, projectRef }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  if (!response.ok) throw new Error(`Hosted catalog query failed with ${response.status}.`);
  return response.json();
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (!token || !projectRef) throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.");

  const local = readdirSync(join(__dirname, "..", "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql")).map((name) => name.split("_")[0]).sort();
  const rows = await query("select version from supabase_migrations.schema_migrations order by version",
    { token, projectRef });
  const { missing, unknown } = compareMigrations(local, rows.map((row) => row.version));
  if (missing.length || unknown.length)
    throw new Error(`Hosted migrations differ. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}.`);

  const [catalogRow] = await query(CATALOG_SQL.trim().replace(/;$/u, ""), { token, projectRef });
  const catalog = JSON.parse(Object.values(catalogRow)[0]);
  const violations = analyzeCatalog(catalog).filter((violation) => !isHardenedPlatformFunction(violation, catalog));
  if (violations.length) {
    throw new Error(`Hosted catalog check found ${violations.length} violation(s):\n${violations
      .map((violation) => `- ${violation.rule}: ${violation.message}`).join("\n")}`);
  }
  console.log(`Hosted database check passed: ${local.length} migrations applied, 0 catalog violations.`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { compareMigrations, isHardenedPlatformFunction };
