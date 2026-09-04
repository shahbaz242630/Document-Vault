const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const { analyzeCatalog } = require("./supabase-db-security-check.cjs");

const rlsHelperMigration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819091516_harden_rls_auto_enable_execution.sql"), "utf8");

test("revokes direct execution of the hosted RLS event-trigger helper", () => {
  assert.match(
    rlsHelperMigration,
    /if\s+to_regprocedure\('public\.rls_auto_enable\(\)'\)\s+is\s+not\s+null/iu,
  );
  for (const role of ["public", "anon", "authenticated", "service_role"])
    assert.match(rlsHelperMigration, new RegExp(
      `revoke all on function public\\.rls_auto_enable\\(\\) from ${role}`));
  assert.doesNotMatch(rlsHelperMigration, /grant\s+execute/iu);
});

const expectedTables = [
  ["account_deletion_requests", ["SELECT", "INSERT"]],
  ["audit_events", ["SELECT", "INSERT"]],
  ["claimant_audit_events", []],
  ["claimant_app_attest_events", []],
  ["claimant_app_attest_keys", []],
  ["claimant_app_attest_challenges", []],
  ["claimant_case_device_keys", []],
  ["claimant_cases", []],
  ["claimant_device_keys", []],
  ["claimant_encrypted_package_deliveries", []],
  ["claimant_encrypted_package_delivery_events", []],
  ["claimant_encrypted_package_delivery_idempotency", []],
  ["claimant_evidence_preparation_items", []],
  ["claimant_evidence_upload_capabilities", []],
  ["claimant_evidence_objects", []],
  ["claimant_identities", []],
  ["claimant_idempotency_records", []],
  ["claimant_intake_snapshots", []],
  ["claimant_invitations", []],
  ["claimant_native_enrollment_challenges", []],
  ["claimant_native_enrollment_rate_limits", []],
  ["claimant_offline_code_v2_attempts", []],
  ["claimant_offline_code_v2_challenges", []],
  ["claimant_offline_code_v2_handoffs", []],
  ["claimant_offline_code_v2_events", []],
  ["claimant_offline_code_v2_idempotency", []],
  ["claimant_offline_code_v2_locators", []],
  ["claimant_offline_code_v2_rate_limits", []],
  ["claimant_outbox", []],
  ["claimant_owner_notice_deliveries", []],
  ["claimant_owner_protection_cycles", []],
  ["claimant_owner_protection_events", []],
  ["claimant_owner_protection_idempotency", []],
  ["claimant_submission_receipts", []],
  ["claimant_checklist_items", []],
  ["claimant_portal_eligibilities", []],
  ["claimant_portal_session_controls", []],
  ["claimant_portal_session_events", []],
  ["claimant_recipient_grants", []],
  ["claimant_release_authority_identities", []],
  ["claimant_release_authorization_events", []],
  ["claimant_release_authorization_idempotency", []],
  ["claimant_release_authorizations", []],
  ["claimant_release_package_assets", []],
  ["claimant_release_package_events", []],
  ["claimant_release_package_finalization_events", []],
  ["claimant_release_package_finalization_idempotency", []],
  ["claimant_release_package_finalizations", []],
  ["claimant_release_package_grants", []],
  ["claimant_release_package_idempotency", []],
  ["claimant_release_packages", []],
  ["claimant_release_retrieval_session_events", []],
  ["claimant_release_retrieval_session_idempotency", []],
  ["claimant_release_retrieval_sessions", []],
  ["claimant_release_signed_manifests", []],
  ["claimant_release_signing_authorities", []],
  ["claimant_release_signing_keys", []],
  ["claimant_retrieval_access_control_events", []],
  ["claimant_retrieval_access_control_idempotency", []],
  ["claimant_retrieval_access_controls", []],
  ["claimant_retrieval_completion_events", []],
  ["claimant_retrieval_completion_idempotency", []],
  ["claimant_retrieval_completions", []],
  ["claimant_retrieval_lifecycle_closure_events", []],
  ["claimant_retrieval_lifecycle_closure_idempotency", []],
  ["claimant_retrieval_lifecycle_closures", []],
  ["claimant_review_decisions", []],
  ["claimant_review_events", []],
  ["claimant_review_idempotency", []],
  ["claimant_review_intervention_events", []],
  ["claimant_review_intervention_idempotency", []],
  ["claimant_review_interventions", []],
  ["claimant_review_resolution_authorities", []],
  ["claimant_review_rounds", []],
  ["claimant_reviewer_assignment_events", []],
  ["claimant_reviewer_assignment_idempotency", []],
  ["claimant_reviewer_assignments", []],
  ["claimant_reviewer_identities", []],
  ["claimant_session_controls", []],
  ["claimant_session_events", []],
  ["emergency_contacts", ["SELECT", "INSERT", "UPDATE"]],
  ["emergency_key_grants", ["SELECT", "INSERT", "UPDATE"]],
  ["emergency_release_requests", ["SELECT", "INSERT"]],
  ["vault_assets", ["SELECT", "INSERT", "UPDATE", "DELETE"]],
  ["vault_key_material", ["SELECT", "INSERT", "UPDATE"]],
];

test("tracks every migrated public table and claimant function explicitly", () => {
  const migrationDirectory = join(__dirname, "../supabase/migrations");
  const sql = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(migrationDirectory, name), "utf8"))
    .join("\n");
  const migratedTables = [...new Set([...sql.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/giu,
  )].map((match) => match[1]))].sort();
  const protectedFunctions = [...new Set([...sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/giu,
  )].map((match) => match[1]))]
    .filter((name) => name.startsWith("claimant_") || name === "bind_claimant_case_initial_key")
    .sort();

  assert.deepEqual(expectedTables.map(([name]) => name).sort(), migratedTables);
  assert.deepEqual(createCatalog().functions.map(({ functionName }) => functionName).sort(),
    protectedFunctions);
});

const tablePrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

test("passes a locked-down Supabase catalog", () => {
  const result = analyzeCatalog(createCatalog());

  assert.deepEqual(result, []);
});

test("flags RLS, grants, metadata policies, views, and security definer functions", () => {
  const catalog = createCatalog();

  catalog.tables[0].rlsEnabled = false;
  catalog.privileges.push({
    hasPrivilege: true,
    privilege: "SELECT",
    roleName: "anon",
    tableName: "vault_assets",
  });
  catalog.privileges.find(
    (privilege) =>
      privilege.roleName === "authenticated" &&
      privilege.tableName === "vault_assets" &&
      privilege.privilege === "TRUNCATE",
  ).hasPrivilege = true;
  catalog.policies.push({
    command: "SELECT",
    qual: "auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'",
    roles: ["authenticated"],
    tableName: "vault_assets",
    withCheck: null,
  });
  catalog.views.push({ reloptions: [], viewName: "unsafe_view" });
  catalog.functions.push({ functionName: "unsafe_fn", securityDefiner: true });
  catalog.functionPrivileges.push({
    functionName: "unsafe_fn",
    hasPrivilege: true,
    roleName: "authenticated",
  });

  assert.deepEqual(
    analyzeCatalog(catalog).map((violation) => violation.rule),
    [
      "public-table-rls-enabled",
      "anon-no-public-table-privileges",
      "authenticated-no-extra-table-privileges",
      "policy-no-user-metadata-authz",
      "public-view-security-invoker",
      "public-function-no-security-definer",
      "public-function-no-client-execute",
    ],
  );
});

test("requires an explicit deny-all policy on every server-only claimant table", () => {
  const catalog = createCatalog();
  const policy = catalog.policies.find((candidate) => candidate.tableName === "claimant_cases");
  policy.qual = "auth.uid() = claimant_user_id";
  policy.withCheck = "auth.uid() = claimant_user_id";

  assert.deepEqual(
    analyzeCatalog(catalog)
      .filter((violation) => violation.table === "claimant_cases")
      .map((violation) => violation.rule),
    ["server-only-table-explicit-deny-policy"],
  );
});

function createCatalog() {
  const functions = [
    { functionName: "claimant_accept_registered_invitation", securityDefiner: false },
    { functionName: "claimant_issue_registered_invitation", securityDefiner: false },
    { functionName: "claimant_activate_session", securityDefiner: false },
    { functionName: "claimant_assert_active_session", securityDefiner: false },
    { functionName: "claimant_revoke_session", securityDefiner: false },
    { functionName: "claimant_activate_portal_session", securityDefiner: false },
    { functionName: "claimant_assert_portal_session", securityDefiner: false },
    { functionName: "claimant_revoke_portal_session", securityDefiner: false },
    { functionName: "claimant_revoke_registered_invitation", securityDefiner: false },
    { functionName: "claimant_manage_registered_recipient", securityDefiner: false },
    { functionName: "bind_claimant_case_initial_key", securityDefiner: false },
    { functionName: "claimant_register_app_attest_key", securityDefiner: false },
    { functionName: "claimant_advance_app_attest_assertion", securityDefiner: false },
    { functionName: "claimant_issue_app_attest_registration_challenge", securityDefiner: false },
    { functionName: "claimant_get_app_attest_registration_challenge", securityDefiner: false },
    { functionName: "claimant_consume_app_attest_registration_challenge", securityDefiner: false },
    { functionName: "claimant_issue_native_enrollment_challenge", securityDefiner: false },
    { functionName: "claimant_get_native_enrollment_evidence", securityDefiner: false },
    { functionName: "claimant_accept_native_enrollment", securityDefiner: false },
    { functionName: "claimant_take_native_enrollment_rate_limit", securityDefiner: false },
    { functionName: "claimant_get_native_enrollment_authority", securityDefiner: false },
    { functionName: "claimant_reconcile_native_enrollment", securityDefiner: false },
    { functionName: "claimant_initialize_claim_intake", securityDefiner: false },
    { functionName: "claimant_record_evidence_preparation", securityDefiner: false },
    { functionName: "claimant_issue_evidence_upload_capability", securityDefiner: false },
    { functionName: "claimant_record_evidence_quarantine", securityDefiner: false },
    { functionName: "claimant_record_evidence_scan", securityDefiner: false },
    { functionName: "claimant_plan_evidence_deletion", securityDefiner: false },
    { functionName: "claimant_confirm_evidence_deleted", securityDefiner: false },
    { functionName: "claimant_get_evidence_upload_reconciliation", securityDefiner: false },
    { functionName: "claimant_abandon_evidence_upload", securityDefiner: false },
    { functionName: "claimant_submit_claim_for_review", securityDefiner: false },
    { functionName: "claimant_assign_reviewer", securityDefiner: false },
    { functionName: "claimant_authorize_release", securityDefiner: false },
    { functionName: "claimant_authorize_release_retrieval_session", securityDefiner: false },
    { functionName: "claimant_begin_owner_notice", securityDefiner: false },
    { functionName: "claimant_bind_offline_code_v2_case", securityDefiner: false },
    { functionName: "claimant_offline_code_v2_handoff", securityDefiner: false },
    { functionName: "claimant_claim_owner_notice_delivery", securityDefiner: false },
    { functionName: "claimant_close_retrieval_lifecycle", securityDefiner: false },
    { functionName: "claimant_commit_encrypted_package_delivery", securityDefiner: false },
    { functionName: "claimant_complete_owner_notice_delivery", securityDefiner: false },
    { functionName: "claimant_complete_verified_native_open", securityDefiner: false },
    { functionName: "claimant_declare_reviewer_conflict", securityDefiner: false },
    { functionName: "claimant_end_release_retrieval_access", securityDefiner: false },
    { functionName: "claimant_finalize_signed_release_package", securityDefiner: false },
    { functionName: "claimant_issue_offline_code_v2_challenge", securityDefiner: false },
    { functionName: "claimant_open_review_intervention", securityDefiner: false },
    { functionName: "claimant_prepare_encrypted_package_delivery", securityDefiner: false },
    { functionName: "claimant_prepare_encrypted_release_package", securityDefiner: false },
    { functionName: "claimant_record_independent_review", securityDefiner: false },
    { functionName: "claimant_record_offline_code_v2_attempt", securityDefiner: false },
    { functionName: "claimant_record_owner_notice_delivery", securityDefiner: false },
    { functionName: "claimant_recuse_reviewer", securityDefiner: false },
    { functionName: "claimant_register_offline_code_v2_locator", securityDefiner: false },
    { functionName: "claimant_revoke_offline_code_v2_locator", securityDefiner: false },
    { functionName: "claimant_stop_owner_protection", securityDefiner: false },
  ];

  return {
    functionPrivileges: functions.flatMap(({ functionName }) => [
      { functionName, hasPrivilege: false, roleName: "anon" },
      { functionName, hasPrivilege: false, roleName: "authenticated" },
    ]),
    functions,
    policies: expectedTables.flatMap(([tableName, privileges]) =>
      privileges.length === 0
        ? [
            {
              command: "ALL",
              qual: "false",
              roles: ["anon", "authenticated"],
              tableName,
              withCheck: "false",
            },
          ]
        : [
            {
              command: "SELECT",
              qual: "auth.uid() = user_id",
              roles: ["authenticated"],
              tableName,
              withCheck: null,
            },
            ...(
              privileges.includes("INSERT")
                ? [
                    {
                      command: "INSERT",
                      qual: null,
                      roles: ["authenticated"],
                      tableName,
                      withCheck: "auth.uid() = user_id",
                    },
                  ]
                : []
            ),
            ...(
              privileges.includes("UPDATE")
                ? [
                    {
                      command: "UPDATE",
                      qual: "auth.uid() = user_id",
                      roles: ["authenticated"],
                      tableName,
                      withCheck: "auth.uid() = user_id",
                    },
                  ]
                : []
            ),
          ],
    ),
    privileges: expectedTables.flatMap(([tableName, expected]) => [
      ...tablePrivileges.map((privilege) => ({
        hasPrivilege: false,
        privilege,
        roleName: "anon",
        tableName,
      })),
      ...tablePrivileges.map((privilege) => ({
        hasPrivilege: expected.includes(privilege),
        privilege,
        roleName: "authenticated",
        tableName,
      })),
    ]),
    tables: expectedTables.map(([tableName]) => ({
      rlsEnabled: true,
      tableName,
    })),
    views: [],
  };
}
