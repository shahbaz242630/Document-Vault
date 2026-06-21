const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("fails the ZAP gate only when the report contains high-risk alerts", () => {
  const checkerPath = path.resolve(__dirname, "zap-report-check.cjs");

  assert.equal(fs.existsSync(checkerPath), true, "ZAP report checker must exist");

  const { evaluateZapReport } = require(checkerPath);
  const report = {
    site: [
      {
        alerts: [
          { alert: "Informational", riskcode: "0" },
          { alert: "Medium finding", riskcode: "2" },
        ],
      },
    ],
  };

  assert.deepEqual(evaluateZapReport(report), {
    highRiskAlerts: [],
    ok: true,
  });

  report.site[0].alerts.push({ alert: "High finding", riskcode: "3" });

  assert.deepEqual(evaluateZapReport(report), {
    highRiskAlerts: [{ alert: "High finding", riskcode: "3" }],
    ok: false,
  });
});
