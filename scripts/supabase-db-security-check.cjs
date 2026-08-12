const { execFileSync } = require("node:child_process");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const EXPECTED_AUTHENTICATED_PRIVILEGES = {
  account_deletion_requests: ["SELECT", "INSERT"],
  audit_events: ["SELECT", "INSERT"],
  claimant_audit_events: [],
  claimant_app_attest_events: [],
  claimant_app_attest_keys: [],
  claimant_app_attest_challenges: [],
  claimant_case_device_keys: [],
  claimant_cases: [],
  claimant_device_keys: [],
  claimant_evidence_preparation_items: [],
  claimant_evidence_upload_capabilities: [],
  claimant_evidence_objects: [],
  claimant_identities: [],
  claimant_idempotency_records: [],
  claimant_intake_snapshots: [],
  claimant_invitations: [],
  claimant_native_enrollment_challenges: [],
  claimant_native_enrollment_rate_limits: [],
  claimant_outbox: [],
  claimant_checklist_items: [],
  claimant_portal_eligibilities: [],
  claimant_portal_session_controls: [],
  claimant_portal_session_events: [],
  claimant_recipient_grants: [],
  claimant_session_controls: [],
  claimant_session_events: [],
  emergency_contacts: ["SELECT", "INSERT", "UPDATE"],
  emergency_key_grants: ["SELECT", "INSERT", "UPDATE"],
  emergency_release_requests: ["SELECT", "INSERT"],
  vault_assets: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  vault_key_material: ["SELECT", "INSERT", "UPDATE"],
};
const EXPECTED_SERVER_ONLY_FUNCTIONS = new Set([
  "claimant_accept_registered_invitation",
  "claimant_issue_registered_invitation",
  "claimant_activate_session",
  "claimant_assert_active_session",
  "claimant_revoke_session",
  "claimant_activate_portal_session",
  "claimant_assert_portal_session",
  "claimant_revoke_portal_session",
  "claimant_revoke_registered_invitation",
  "claimant_manage_registered_recipient",
  "bind_claimant_case_initial_key",
  "claimant_register_app_attest_key",
  "claimant_advance_app_attest_assertion",
  "claimant_issue_app_attest_registration_challenge",
  "claimant_get_app_attest_registration_challenge",
  "claimant_consume_app_attest_registration_challenge",
  "claimant_issue_native_enrollment_challenge",
  "claimant_get_native_enrollment_evidence",
  "claimant_accept_native_enrollment",
  "claimant_take_native_enrollment_rate_limit",
  "claimant_get_native_enrollment_authority",
  "claimant_reconcile_native_enrollment",
  "claimant_initialize_claim_intake",
  "claimant_record_evidence_preparation",
  "claimant_issue_evidence_upload_capability",
  "claimant_record_evidence_quarantine",
  "claimant_record_evidence_scan",
  "claimant_plan_evidence_deletion",
  "claimant_confirm_evidence_deleted",
]);

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
  select p.oid as function_oid, p.proname as function_name, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
function_privileges as (
  select
    f.function_name,
    role_name,
    has_function_privilege(role_name, f.function_oid, 'EXECUTE') as has_privilege
  from public_functions f
  cross join (values ('anon'), ('authenticated')) roles(role_name)
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
  , 'functionPrivileges', coalesce((select json_agg(json_build_object(
    'functionName', function_name,
    'roleName', role_name,
    'hasPrivilege', has_privilege
  ) order by function_name, role_name) from function_privileges), '[]'::json)
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

  collectTableShapeViolations({ expectedTables, policies, tables, violations });
  collectPrivilegeViolations({ privileges, violations });
  collectPolicyViolations({ policies, privileges, violations });
  collectViewViolations({ catalog, violations });
  collectFunctionViolations({ catalog, violations });

  return violations;
}

function collectTableShapeViolations({
  expectedTables,
  policies,
  tables,
  violations,
}) {
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
}

function collectPrivilegeViolations({ privileges, violations }) {
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
}

function collectPolicyViolations({ policies, privileges, violations }) {
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

  for (const tableName of getServerOnlyTables()) {
    const hasExplicitDenyPolicy = policies.some((policy) => {
      const roles = Array.isArray(policy.roles) ? policy.roles : [];
      return (
        policy.tableName === tableName &&
        policy.command === "ALL" &&
        roles.includes("anon") &&
        roles.includes("authenticated") &&
        normalizeBooleanPolicyExpression(policy.qual) === "false" &&
        normalizeBooleanPolicyExpression(policy.withCheck) === "false"
      );
    });

    if (!hasExplicitDenyPolicy) {
      violations.push({
        message: `Server-only table public.${tableName} must retain an explicit deny-all policy for anon and authenticated.`,
        rule: "server-only-table-explicit-deny-policy",
        table: tableName,
      });
    }
  }

  for (const tableName of getTablesWithExpectedUpdatePrivilege()) {
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
}

function normalizeBooleanPolicyExpression(expression) {
  return String(expression ?? "").replace(/[()\s]/g, "").toLowerCase();
}

function getServerOnlyTables() {
  return Object.entries(EXPECTED_AUTHENTICATED_PRIVILEGES)
    .filter(([, expected]) => expected.length === 0)
    .map(([tableName]) => tableName);
}

function getTablesWithExpectedUpdatePrivilege() {
  return Object.entries(EXPECTED_AUTHENTICATED_PRIVILEGES)
    .filter(([, expected]) => expected.includes("UPDATE"))
    .map(([tableName]) => tableName);
}

function collectViewViolations({ catalog, violations }) {
  for (const view of catalog.views ?? []) {
    if (!view.reloptions?.includes("security_invoker=true")) {
      violations.push({
        message: `Public view ${view.viewName} must use security_invoker=true or stay unexposed.`,
        rule: "public-view-security-invoker",
        view: view.viewName,
      });
    }
  }
}

function collectFunctionViolations({ catalog, violations }) {
  const functions = catalog.functions ?? [];
  for (const fn of functions) {
    if (fn.securityDefiner) {
      violations.push({
        function: fn.functionName,
        message: `Security definer function public.${fn.functionName} is in an exposed schema.`,
        rule: "public-function-no-security-definer",
      });
    }
  }

  for (const functionName of EXPECTED_SERVER_ONLY_FUNCTIONS) {
    if (!functions.some((fn) => fn.functionName === functionName)) {
      violations.push({
        function: functionName,
        message: `Expected server-only function public.${functionName} is missing.`,
        rule: "expected-public-function-present",
      });
    }
  }

  for (const privilege of catalog.functionPrivileges ?? []) {
    if (privilege.hasPrivilege && ["anon", "authenticated"].includes(privilege.roleName)) {
      violations.push({
        function: privilege.functionName,
        message: `${privilege.roleName} can execute public.${privilege.functionName}.`,
        role: privilege.roleName,
        rule: "public-function-no-client-execute",
      });
    }
  }
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
