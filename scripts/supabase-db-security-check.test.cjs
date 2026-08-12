const assert = require("node:assert/strict");
const test = require("node:test");

const { analyzeCatalog } = require("./supabase-db-security-check.cjs");

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
  ["claimant_evidence_preparation_items", []],
  ["claimant_identities", []],
  ["claimant_idempotency_records", []],
  ["claimant_intake_snapshots", []],
  ["claimant_invitations", []],
  ["claimant_native_enrollment_challenges", []],
  ["claimant_native_enrollment_rate_limits", []],
  ["claimant_outbox", []],
  ["claimant_checklist_items", []],
  ["claimant_portal_eligibilities", []],
  ["claimant_portal_session_controls", []],
  ["claimant_portal_session_events", []],
  ["claimant_recipient_grants", []],
  ["claimant_session_controls", []],
  ["claimant_session_events", []],
  ["emergency_contacts", ["SELECT", "INSERT", "UPDATE"]],
  ["emergency_key_grants", ["SELECT", "INSERT", "UPDATE"]],
  ["emergency_release_requests", ["SELECT", "INSERT"]],
  ["vault_assets", ["SELECT", "INSERT", "UPDATE", "DELETE"]],
  ["vault_key_material", ["SELECT", "INSERT", "UPDATE"]],
];

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
