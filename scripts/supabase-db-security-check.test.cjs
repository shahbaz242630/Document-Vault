const assert = require("node:assert/strict");
const test = require("node:test");

const { analyzeCatalog } = require("./supabase-db-security-check.cjs");

const expectedTables = [
  ["account_deletion_requests", ["SELECT", "INSERT"]],
  ["audit_events", ["SELECT", "INSERT"]],
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

  assert.deepEqual(
    analyzeCatalog(catalog).map((violation) => violation.rule),
    [
      "public-table-rls-enabled",
      "anon-no-public-table-privileges",
      "authenticated-no-extra-table-privileges",
      "policy-no-user-metadata-authz",
      "public-view-security-invoker",
      "public-function-no-security-definer",
    ],
  );
});

function createCatalog() {
  return {
    functions: [],
    policies: expectedTables.flatMap(([tableName, privileges]) => [
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
    ]),
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
