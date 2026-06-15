const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runSecurityCheck } = require("./security-check.cjs");

test("passes the repository security guard", () => {
  const workspaceRoot = path.join(__dirname, "..");
  const result = runSecurityCheck({ cwd: workspaceRoot });

  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
});

test("fails weak Supabase auth config, missing RLS, anon grants, and mobile secret markers", () => {
  const workspace = createWorkspace({
    "apps/mobile/src/leak.ts": "export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    "supabase/config.toml": [
      "[auth]",
      "minimum_password_length = 6",
      "[auth.email]",
      "secure_password_change = false",
      "",
    ].join("\n"),
    "supabase/migrations/20260614000000_bad.sql": [
      "create table public.secret_records (id uuid primary key);",
      "grant select on table public.secret_records to anon;",
      "",
    ].join("\n"),
  });

  try {
    const result = runSecurityCheck({ cwd: workspace });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.violations.map((violation) => violation.rule).sort(),
      [
        "mobile-no-server-secret-markers",
        "supabase-authenticated-revoke-all",
        "supabase-no-anon-table-grants",
        "supabase-password-minimum",
        "supabase-public-table-rls",
        "supabase-secure-password-change",
      ].sort(),
    );
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});

function createWorkspace(files) {
  const workspace = mkdtempSync(path.join(tmpdir(), "sanduqkin-security-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(workspace, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  return workspace;
}
