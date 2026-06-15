const { execFileSync } = require("node:child_process");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const EXPECTED_AUTHENTICATED_PRIVILEGES = {
  account_deletion_requests: ["SELECT", "INSERT"],
  audit_events: ["SELECT", "INSERT"],
  emergency_contacts: ["SELECT", "INSERT", "UPDATE"],
  emergency_key_grants: ["SELECT", "INSERT", "UPDATE"],
  emergency_release_requests: ["SELECT", "INSERT"],
  vault_assets: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  vault_key_material: ["SELECT", "INSERT", "UPDATE"],
};

const CATALOG_SQL = `
with public_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
table_privileges as (
  select
    t.table_name,
    role_name,
    privilege,
    has_table_privilege(role_name, format('%I.%I', t.schema_name, t.table_name), privilege) as has_privilege
  from public_tables t
  cross join (values ('anon'), ('authenticated')) roles(role_name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privileges(privilege)
),
table_policies as (
  select schemaname, tablename, cmd, roles, qual, with_check
  from pg_policies
  where schemaname = 'public'
),
public_views as (
  select c.relname as view_name, c.relkind, coalesce(c.reloptions, array[]::text[]) as reloptions
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')
),
public_functions as (
  select p.proname as function_name, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select json_build_object(
  'tables', coalesce((select json_agg(json_build_object(
    'tableName', table_name,
    'rlsEnabled', relrowsecurity
  ) order by table_name) from public_tables), '[]'::json),
  'privileges', coalesce((select json_agg(json_build_object(
    'tableName', table_name,
    'roleName', role_name,
    'privilege', privilege,
    'hasPrivilege', has_privilege
  ) order by table_name, role_name, privilege) from table_privileges), '[]'::json),
  'policies', coalesce((select json_agg(json_build_object(
    'tableName', tablename,
    'command', cmd,
    'roles', roles,
    'qual', qual,
    'withCheck', with_check
  ) order by tablename, cmd) from table_policies), '[]'::json),
  'views', coalesce((select json_agg(json_build_object(
    'viewName', view_name,
    'relkind', relkind,
    'reloptions', reloptions
  ) order by view_name) from public_views), '[]'::json),
  'functions', coalesce((select json_agg(json_build_object(
    'functionName', function_name,
    'securityDefiner', prosecdef
  ) order by function_name) from public_functions), '[]'::json)
)::text;
`;

function runSupabaseDbSecurityCheck(options = {}) {
  const catalog = options.catalog ?? readCatalogFromDocker(options.container ?? DEFAULT_CONTAINER);
  const violations = analyzeCatalog(catalog);

  return {
    ok: violations.length === 0,
    violations,
  };
}

function readCatalogFromDocker(container) {
  const output = execFileSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      CATALOG_SQL,
    ],
    { encoding: "utf8" },
  ).trim();

  if (!output) {
    throw new Error("Supabase catalog query returned no output.");
  }

  return JSON.parse(output);
}

function analyzeCatalog(catalog) {
  const violations = [];
  const expectedTables = new Set(Object.keys(EXPECTED_AUTHENTICATED_PRIVILEGES));
  const tables = catalog.tables ?? [];
  const policies = catalog.policies ?? [];
  const privileges = catalog.privileges ?? [];

  for (const table of tables) {
    if (!expectedTables.has(table.tableName)) {
      violations.push({
        message: `Unexpected public table ${table.tableName}; add an explicit security expectation before exposing it.`,
        rule: "unexpected-public-table",
        table: table.tableName,
      });
      continue;
    }

    if (table.rlsEnabled !== true) {
      violations.push({
        message: `Public table ${table.tableName} does not have RLS enabled.`,
        rule: "public-table-rls-enabled",
        table: table.tableName,
      });
    }

    if (!policies.some((policy) => policy.tableName === table.tableName)) {
      violations.push({
        message: `Public table ${table.tableName} has no RLS policies.`,
        rule: "public-table-has-policies",
        table: table.tableName,
      });
    }
  }

  for (const tableName of expectedTables) {
    if (!tables.some((table) => table.tableName === tableName)) {
      violations.push({
        message: `Expected public table ${tableName} is missing from the live catalog.`,
        rule: "expected-public-table-present",
        table: tableName,
      });
    }
  }

  for (const privilege of privileges) {
    if (privilege.roleName === "anon" && privilege.hasPrivilege) {
      violations.push({
        message: `Anon has ${privilege.privilege} on public.${privilege.tableName}.`,
        privilege: privilege.privilege,
        role: "anon",
        rule: "anon-no-public-table-privileges",
        table: privilege.tableName,
      });
    }
  }

  for (const [tableName, expectedPrivilegeList] of Object.entries(EXPECTED_AUTHENTICATED_PRIVILEGES)) {
    const expected = new Set(expectedPrivilegeList);

    for (const privilege of TABLE_PRIVILEGES) {
      const row = privileges.find(
        (candidate) =>
          candidate.roleName === "authenticated" &&
          candidate.tableName === tableName &&
          candidate.privilege === privilege,
      );
      const hasPrivilege = row?.hasPrivilege === true;

      if (expected.has(privilege) && !hasPrivilege) {
        violations.push({
          message: `Authenticated is missing expected ${privilege} on public.${tableName}.`,
          privilege,
          role: "authenticated",
          rule: "authenticated-expected-table-privilege",
          table: tableName,
        });
      }

      if (!expected.has(privilege) && hasPrivilege) {
        violations.push({
          message: `Authenticated has unexpected ${privilege} on public.${tableName}.`,
          privilege,
          role: "authenticated",
          rule: "authenticated-no-extra-table-privileges",
          table: tableName,
        });
      }
    }
  }

  for (const policy of policies) {
    const policyText = `${policy.qual ?? ""} ${policy.withCheck ?? ""}`;
    if (/\b(?:raw_user_meta_data|user_metadata)\b/i.test(policyText)) {
      violations.push({
        message: `Policy on public.${policy.tableName} uses user-editable metadata.`,
        rule: "policy-no-user-metadata-authz",
        table: policy.tableName,
      });
    }
  }

  for (const tableName of Object.entries(EXPECTED_AUTHENTICATED_PRIVILEGES)
    .filter(([, expected]) => expected.includes("UPDATE"))
    .map(([tableName]) => tableName)) {
    const tablePolicies = policies.filter((policy) => policy.tableName === tableName);
    const hasSelectPolicy = tablePolicies.some((policy) => policy.command === "SELECT" || policy.command === "ALL");
    const hasUpdatePolicy = tablePolicies.some((policy) => policy.command === "UPDATE" || policy.command === "ALL");

    if (!hasSelectPolicy || !hasUpdatePolicy) {
      violations.push({
        message: `Table public.${tableName} grants UPDATE but lacks both SELECT and UPDATE policies.`,
        rule: "update-grant-requires-select-and-update-policies",
        table: tableName,
      });
    }
  }

  for (const view of catalog.views ?? []) {
    if (!view.reloptions?.includes("security_invoker=true")) {
      violations.push({
        message: `Public view ${view.viewName} must use security_invoker=true or stay unexposed.`,
        rule: "public-view-security-invoker",
        view: view.viewName,
      });
    }
  }

  for (const fn of catalog.functions ?? []) {
    if (fn.securityDefiner) {
      violations.push({
        function: fn.functionName,
        message: `Security definer function public.${fn.functionName} is in an exposed schema.`,
        rule: "public-function-no-security-definer",
      });
    }
  }

  return violations;
}

function printResult(result) {
  if (result.ok) {
    console.log("Supabase DB security catalog check passed.");
    return;
  }

  console.error("Supabase DB security catalog check failed:");
  for (const violation of result.violations) {
    const subject = violation.table ?? violation.view ?? violation.function ?? "catalog";
    console.error(`- ${violation.rule}: ${subject} ${violation.message}`);
  }
}

if (require.main === module) {
  try {
    const result = runSupabaseDbSecurityCheck();
    printResult(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  analyzeCatalog,
  runSupabaseDbSecurityCheck,
};
