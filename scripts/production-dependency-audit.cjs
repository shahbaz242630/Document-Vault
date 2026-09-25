const { spawnSync } = require("node:child_process");

function evaluateAuditReport(report) {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const violations = Object.values(vulnerabilities)
    .filter((entry) => ["high", "critical"].includes(entry.severity))
    .map((vulnerability) => ({
      name: vulnerability.name,
      severity: vulnerability.severity,
      advisories: [...collectAdvisoryUrls(vulnerability.name, vulnerabilities)].sort(),
    }));
  return { ok: violations.length === 0, violations };
}

function collectAdvisoryUrls(packageName, vulnerabilities, visiting = new Set()) {
  if (visiting.has(packageName)) return new Set();
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return new Set([`unknown-package:${packageName}`]);

  const nextVisiting = new Set(visiting).add(packageName);
  const urls = new Set();
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === "string") {
      for (const url of collectAdvisoryUrls(cause, vulnerabilities, nextVisiting)) urls.add(url);
    } else if (typeof cause?.url === "string") {
      urls.add(cause.url);
    } else {
      urls.add(`unknown-advisory:${packageName}`);
    }
  }
  return urls;
}

function runCli() {
  const cwd = process.cwd();
  const audit = spawnSync(
    "npm",
    ["audit", "--omit=dev", "--workspaces", "--audit-level=high", "--json"],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      shell: process.platform === "win32",
    },
  );
  if (!audit.stdout) {
    console.error(audit.error?.message || audit.stderr || "npm audit did not return a JSON report.");
    return 1;
  }

  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    console.error("npm audit returned malformed JSON.");
    return 1;
  }

  const result = evaluateAuditReport(report);
  if (!result.ok) {
    console.error("Production dependency audit failed:");
    for (const violation of result.violations) {
      console.error(`- ${violation.name} (${violation.severity})`);
      for (const advisory of violation.advisories) console.error(`  ${advisory}`);
    }
    return 1;
  }

  console.log("Production dependency audit passed with no high or critical advisories.");
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { evaluateAuditReport };
