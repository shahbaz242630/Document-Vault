const assert = require("node:assert/strict");
const test = require("node:test");

const { evaluateAuditReport } = require("./production-dependency-audit.cjs");

const approvedAdvisory = {
  name: "image-size",
  severity: "high",
  url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
};

test("allows only patched image-size advisory dependency paths before review deadline", () => {
  const report = {
    vulnerabilities: {
      "image-size": { name: "image-size", severity: "high", via: [approvedAdvisory] },
      metro: { name: "metro", severity: "high", via: ["image-size"] },
      expo: { name: "expo", severity: "high", via: ["metro"] },
    },
  };

  const result = evaluateAuditReport(report, {
    patchVerified: true,
    today: "2026-08-12",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.exempted, ["expo", "image-size", "metro"]);
});

test("fails closed for a new advisory or a missing patch", () => {
  const report = {
    vulnerabilities: {
      "image-size": { name: "image-size", severity: "high", via: [approvedAdvisory] },
      "new-risk": {
        name: "new-risk",
        severity: "critical",
        via: [{ name: "new-risk", url: "https://github.com/advisories/GHSA-new-risk" }],
      },
    },
  };

  assert.equal(
    evaluateAuditReport(report, { patchVerified: true, today: "2026-08-12" }).ok,
    false,
  );
  assert.equal(
    evaluateAuditReport(
      { vulnerabilities: { "image-size": report.vulnerabilities["image-size"] } },
      { patchVerified: false, today: "2026-08-12" },
    ).ok,
    false,
  );
});

test("expires the temporary exception", () => {
  const report = {
    vulnerabilities: {
      "image-size": { name: "image-size", severity: "high", via: [approvedAdvisory] },
    },
  };
  assert.equal(
    evaluateAuditReport(report, { patchVerified: true, today: "2026-10-01" }).ok,
    false,
  );
});
