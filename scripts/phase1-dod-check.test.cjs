const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runPhase1DodCheck } = require("./phase1-dod-check.cjs");

test("passes clean production files while ignoring docs and tests", () => {
  const workspace = createWorkspace({
    "apps/mobile/src/clean.ts": "export function ok() {\n  return true;\n}\n",
    "apps/mobile/src/clean.test.ts": "it('records a TODO in test copy', () => {});\n",
    "HANDOFF.md": "- Historical TODO reference.\n",
  });

  try {
    const result = runPhase1DodCheck({ cwd: workspace });

    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});

test("fails production TODO, oversized file, and long function violations", () => {
  const longFunctionBody = Array.from({ length: 101 }, (_, index) => `  return ${index};`).join("\n");
  const longFile = Array.from({ length: 501 }, (_, index) => `export const line${index} = ${index};`).join("\n");
  const workspace = createWorkspace({
    "apps/mobile/src/todo.ts": "export const marker = 'ok';\n// TODO: remove before launch\n",
    "services/api/src/long-file.ts": `${longFile}\n`,
    "packages/shared-validation/src/long-function.ts": `export function tooLong() {\n${longFunctionBody}\n}\n`,
  });

  try {
    const result = runPhase1DodCheck({ cwd: workspace });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.violations.map((violation) => violation.rule),
      ["production-todo", "file-line-limit", "function-line-limit"],
    );
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});

test("keeps reset password panel under the function line limit", () => {
  const workspaceRoot = path.join(__dirname, "..");
  const result = runPhase1DodCheck({ cwd: workspaceRoot });

  assert.equal(
    result.violations.some(
      (violation) =>
        violation.path === "apps/mobile/src/features/auth/components/reset-password-panel.tsx" &&
        violation.rule === "function-line-limit",
    ),
    false,
  );
});

test("keeps email password auth form under the function line limit", () => {
  const workspaceRoot = path.join(__dirname, "..");
  const result = runPhase1DodCheck({ cwd: workspaceRoot });

  assert.equal(
    result.violations.some(
      (violation) =>
        violation.path === "apps/mobile/src/features/auth/components/email-password-auth-form.tsx" &&
        violation.rule === "function-line-limit",
    ),
    false,
  );
});

function createWorkspace(files) {
  const workspace = mkdtempSync(path.join(tmpdir(), "sanduqkin-dod-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(workspace, relativePath);
    require("node:fs").mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  return workspace;
}
