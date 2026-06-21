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

test("runs every security guard regression suite in Security CI", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  for (const testFile of [
    "scripts/security-check.test.cjs",
    "scripts/mobile-secret-scan.test.cjs",
    "scripts/supabase-db-security-check.test.cjs",
    "scripts/github-actions-security-check.test.cjs",
    "scripts/phase1-dod-check.test.cjs",
  ]) {
    assert.match(workflow, new RegExp(`node --test[^\\n]*${testFile.replaceAll(".", "\\.")}`));
  }
});

test("runs Expo Doctor in Security CI", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /- name: Expo Doctor[\s\S]*?run: npm run doctor --workspace @vault\/mobile/);
});

test("runs Security CI for pushes to every branch", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /\n  push:\s*\n\s*permissions:/);
});

test("configures CodeQL scanning for JavaScript and TypeScript", () => {
  const workflowPath = path.resolve(
    __dirname,
    "..",
    ".github",
    "workflows",
    "codeql.yml",
  );

  assert.equal(fs.existsSync(workflowPath), true, "CodeQL workflow must exist");

  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /\n  pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  schedule:\s*\n\s*- cron: "[^"]+"/);
  assert.match(workflow, /\npermissions:\s*\n\s*contents: read\s*\n\s*security-events: write/);
  assert.match(workflow, /language: \["javascript-typescript"\]/);
  assert.match(workflow, /github\/codeql-action\/init@[a-f0-9]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[a-f0-9]{40}/);
});

test("configures an isolated OWASP ZAP baseline scan for the API", () => {
  const workflowPath = path.resolve(
    __dirname,
    "..",
    ".github",
    "workflows",
    "zap.yml",
  );

  assert.equal(fs.existsSync(workflowPath), true, "OWASP ZAP workflow must exist");

  const workflow = fs.readFileSync(workflowPath, "utf8");
  const securityWorkflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );
  const apiPackage = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "services", "api", "package.json"), "utf8"),
  );

  assert.match(workflow, /\n  pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  schedule:\s*\n\s*- cron: "[^"]+"/);
  assert.match(workflow, /\npermissions:\s*\n\s*contents: read/);
  assert.match(workflow, /name: OWASP ZAP baseline/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /ghcr\.io\/zaproxy\/zaproxy@sha256:[a-f0-9]{64}/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:8787\/health/);
  assert.match(workflow, /-c zap-rules\.tsv/);
  assert.match(workflow, /node scripts\/zap-report-check\.cjs zap-reports\/zap-report\.json/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(securityWorkflow, /node --test[^\n]*scripts\/zap-report-check\.test\.cjs/);
  assert.equal(apiPackage.scripts["start:zap"], "tsx scripts/zap-server.ts");

  const zapRules = fs.readFileSync(path.resolve(__dirname, "..", ".zap", "rules.tsv"), "utf8");
  assert.match(zapRules, /^10049\s+IGNORE\s+/m);
});

test("rejects mutable action tags and accepts full commit SHAs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "pins.yml"),
    [
      "name: pins",
      "on:",
      "  push:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-node@0123456789abcdef0123456789abcdef01234567 # v4",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result.violations.map((violation) => violation.rule), [
    "github-actions-pinned-actions",
  ]);
});

test("checks action allowlisting when a SHA pin has a version comment", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "comment-bypass.yml"),
    [
      "name: comment bypass",
      "on:",
      "  push:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: untrusted/action@0123456789abcdef0123456789abcdef01234567 # v1",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result.violations.map((violation) => violation.rule), [
    "github-actions-allowed-actions",
  ]);
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
