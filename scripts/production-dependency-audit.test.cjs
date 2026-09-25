const assert = require("node:assert/strict");
const test = require("node:test");

const { evaluateAuditReport } = require("./production-dependency-audit.cjs");

const imageSizeAdvisory = {
  name: "image-size",
  severity: "high",
  url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
};

test("passes when no high or critical advisory is reported", () => {
  const result = evaluateAuditReport({
    vulnerabilities: {
      "low-risk": { name: "low-risk", severity: "moderate", via: [] },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("fails on every high advisory path, including the retired image-size exception", () => {
  const result = evaluateAuditReport({
    vulnerabilities: {
      "image-size": { name: "image-size", severity: "high", via: [imageSizeAdvisory] },
      metro: { name: "metro", severity: "high", via: ["image-size"] },
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map((violation) => [violation.name, violation.advisories]),
    [
      ["image-size", [imageSizeAdvisory.url]],
      ["metro", [imageSizeAdvisory.url]],
    ],
  );
});

test("fails closed for critical advisories and unresolvable dependency paths", () => {
  const result = evaluateAuditReport({
    vulnerabilities: {
      "new-risk": {
        name: "new-risk",
        severity: "critical",
        via: ["missing-package", { name: "new-risk" }],
      },
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.violations[0].advisories, [
    "unknown-advisory:new-risk",
    "unknown-package:missing-package",
  ]);
});
