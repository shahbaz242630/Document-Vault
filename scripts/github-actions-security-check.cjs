const fs = require("node:fs");
const path = require("node:path");

const WORKFLOW_DIR = path.join(".github", "workflows");
const ALLOWED_ACTIONS = new Set([
  "actions/checkout",
  "actions/setup-node",
  "github/codeql-action/analyze",
  "github/codeql-action/init",
  "supabase/setup-cli",
]);

function runGitHubActionsSecurityCheck(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const workflowDir = path.join(cwd, options.workflowDir ?? WORKFLOW_DIR);
  const violations = [];

  if (!fs.existsSync(workflowDir)) {
    return { ok: true, violations };
  }

  for (const filePath of collectWorkflowFiles(workflowDir)) {
    const relativePath = normalizePath(path.relative(cwd, filePath));
    const contents = fs.readFileSync(filePath, "utf8");

    violations.push(
      ...checkWorkflowTriggers(relativePath, contents),
      ...checkWorkflowPermissions(relativePath, contents),
      ...checkWorkflowActions(relativePath, contents),
      ...checkWorkflowSecrets(relativePath, contents),
    );
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

function checkWorkflowTriggers(filePath, contents) {
  if (!/^\s*pull_request_target\s*:/m.test(contents)) {
    return [];
  }

  return [
    {
      message: "Do not use pull_request_target for repository CI; it can expose trusted context to untrusted PR code.",
      path: filePath,
      rule: "github-actions-no-pull-request-target",
    },
  ];
}

function checkWorkflowPermissions(filePath, contents) {
  const violations = [];

  if (/^\s*permissions\s*:\s*write-all\s*$/m.test(contents)) {
    violations.push({
      message: "Workflow permissions must not use write-all.",
      path: filePath,
      rule: "github-actions-no-write-all-permissions",
    });
  }

  if (!/^\s*permissions\s*:\s*$/m.test(contents) || !/^\s*contents\s*:\s*read\s*$/m.test(contents)) {
    violations.push({
      message: "Workflow must declare minimal top-level permissions with contents: read.",
      path: filePath,
      rule: "github-actions-minimal-permissions",
    });
  }

  return violations;
}

function checkWorkflowActions(filePath, contents) {
  const violations = [];
  const usesMatches = [...contents.matchAll(/^\s*-?\s*uses\s*:\s*([^\s#]+)(?:\s+#.*)?\s*$/gm)];

  for (const match of usesMatches) {
    const actionRef = String(match[1]).replace(/^["']|["']$/g, "");
    const separatorIndex = actionRef.lastIndexOf("@");
    const actionName = separatorIndex >= 0 ? actionRef.slice(0, separatorIndex) : actionRef;
    const version = separatorIndex >= 0 ? actionRef.slice(separatorIndex + 1) : "";

    if (!/^[a-f0-9]{40}$/i.test(version)) {
      violations.push({
        action: actionRef,
        message: `Action ${actionRef} must be pinned to a full 40-character commit SHA.`,
        path: filePath,
        rule: "github-actions-pinned-actions",
      });
    }

    if (!ALLOWED_ACTIONS.has(actionName)) {
      violations.push({
        action: actionRef,
        message: `Action ${actionRef} is not in the allowed workflow action list.`,
        path: filePath,
        rule: "github-actions-allowed-actions",
      });
    }
  }

  return violations;
}

function checkWorkflowSecrets(filePath, contents) {
  const hasPullRequestTrigger = /^\s*pull_request\s*:/m.test(contents);

  if (!hasPullRequestTrigger || !/\$\{\{\s*secrets\./.test(contents)) {
    return [];
  }

  return [
    {
      message: "Workflows triggered by pull_request must not reference GitHub secrets.",
      path: filePath,
      rule: "github-actions-no-secrets-on-pr",
    },
  ];
}

function collectWorkflowFiles(workflowDir) {
  return fs
    .readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(workflowDir, entry.name))
    .sort();
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function printResult(result) {
  if (result.ok) {
    console.log("GitHub Actions security check passed.");
    return;
  }

  console.error("GitHub Actions security check failed:");
  for (const violation of result.violations) {
    const action = violation.action ? ` (${violation.action})` : "";
    console.error(`- ${violation.rule}: ${violation.path}${action} ${violation.message}`);
  }
}

if (require.main === module) {
  const result = runGitHubActionsSecurityCheck();
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  runGitHubActionsSecurityCheck,
};
