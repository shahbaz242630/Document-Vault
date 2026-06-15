const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitHubActionsSecurityCheck } = require("./github-actions-security-check.cjs");

test("passes the repository GitHub Actions security check", () => {
  const result = runGitHubActionsSecurityCheck({ cwd: path.resolve(__dirname, "..") });

  assert.deepEqual(result, {
    ok: true,
    violations: [],
  });
});

test("flags dangerous workflow triggers, permissions, actions, and PR secrets", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "unsafe.yml"),
    [
      "name: unsafe",
      "on:",
      "  pull_request:",
      "  pull_request_target:",
      "permissions: write-all",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout",
      "      - uses: bad/action@v1",
      "      - run: echo ${{ secrets.API_KEY }}",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map((violation) => violation.rule),
    [
      "github-actions-no-pull-request-target",
      "github-actions-no-write-all-permissions",
      "github-actions-minimal-permissions",
      "github-actions-pinned-actions",
      "github-actions-allowed-actions",
      "github-actions-no-secrets-on-pr",
    ],
  );
});

test("allows scheduled workflows to use secrets with minimal permissions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "scheduled.yml"),
    [
      "name: scheduled",
      "on:",
      "  workflow_dispatch:",
      "  schedule:",
      "    - cron: '17 2 * * *'",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  call:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo ${{ secrets.PROCESSOR_TOKEN }}",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result, {
    ok: true,
    violations: [],
  });
});
