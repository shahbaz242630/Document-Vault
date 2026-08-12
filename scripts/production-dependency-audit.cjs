const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ALLOWED_IMAGE_SIZE_ADVISORIES = new Set([
  "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
  "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
]);
const IMAGE_SIZE_PATCH_SHA256 =
  "0b3de85d57653a9992cda13653cd0053142d39a1a259e6c4e175f3ebc9a8ff4e";
const REVIEW_BY = "2026-09-30";

function evaluateAuditReport(report, options = {}) {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const material = Object.values(vulnerabilities).filter((entry) =>
    ["high", "critical"].includes(entry.severity),
  );
  if (material.length === 0) {
    return { ok: true, exempted: [], violations: [] };
  }

  const patchVerified = options.patchVerified === true;
  const beforeReviewDeadline = (options.today ?? new Date().toISOString().slice(0, 10)) <= REVIEW_BY;
  const violations = [];
  const exempted = [];

  for (const vulnerability of material) {
    const advisories = collectAdvisoryUrls(vulnerability.name, vulnerabilities);
    const knownOnly =
      advisories.size > 0 &&
      [...advisories].every((url) => ALLOWED_IMAGE_SIZE_ADVISORIES.has(url));
    if (knownOnly && patchVerified && beforeReviewDeadline) {
      exempted.push(vulnerability.name);
    } else {
      violations.push({
        name: vulnerability.name,
        severity: vulnerability.severity,
        advisories: [...advisories].sort(),
        reason: !patchVerified
          ? "image-size security patch is missing or changed"
          : !beforeReviewDeadline
            ? `temporary image-size exception expired after ${REVIEW_BY}`
            : "contains an unapproved advisory",
      });
    }
  }

  return { ok: violations.length === 0, exempted: exempted.sort(), violations };
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

function verifyImageSizePatch(cwd) {
  const lockfile = JSON.parse(fs.readFileSync(path.join(cwd, "package-lock.json"), "utf8"));
  if (lockfile.packages?.["node_modules/image-size"]?.version !== "1.2.1") return false;
  const patchPath = path.join(cwd, "patches", "image-size+1.2.1.patch");
  if (!fs.existsSync(patchPath)) return false;
  const patch = fs.readFileSync(patchPath, "utf8").replace(/\r\n/g, "\n");
  const digest = crypto.createHash("sha256").update(patch).digest("hex");
  return digest === IMAGE_SIZE_PATCH_SHA256;
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

  const result = evaluateAuditReport(report, { patchVerified: verifyImageSizePatch(cwd) });
  if (!result.ok) {
    console.error("Production dependency audit failed:");
    for (const violation of result.violations) {
      console.error(`- ${violation.name} (${violation.severity}): ${violation.reason}`);
      for (const advisory of violation.advisories) console.error(`  ${advisory}`);
    }
    return 1;
  }

  if (result.exempted.length > 0) {
    console.warn(
      `Production dependency audit passed with the patched image-size exception through ${REVIEW_BY}.`,
    );
    console.warn(`Affected dependency paths: ${result.exempted.join(", ")}`);
  } else {
    console.log("Production dependency audit passed with no high or critical advisories.");
  }
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { evaluateAuditReport, verifyImageSizePatch };
