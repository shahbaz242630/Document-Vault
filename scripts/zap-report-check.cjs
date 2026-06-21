const fs = require("node:fs");

function evaluateZapReport(report) {
  const highRiskAlerts = (report.site ?? [])
    .flatMap((site) => site.alerts ?? [])
    .filter((alert) => Number(alert.riskcode) >= 3);

  return {
    highRiskAlerts,
    ok: highRiskAlerts.length === 0,
  };
}

function checkReport(reportPath) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const result = evaluateZapReport(report);

  if (result.ok) {
    console.log("OWASP ZAP baseline passed: no high-risk alerts.");
    return true;
  }

  console.error("OWASP ZAP baseline found high-risk alerts:");
  for (const alert of result.highRiskAlerts) {
    console.error(`- ${alert.alert ?? alert.name ?? "Unnamed ZAP alert"}`);
  }

  return false;
}

if (require.main === module) {
  const reportPath = process.argv[2];

  if (!reportPath) {
    console.error("Usage: node scripts/zap-report-check.cjs <zap-report.json>");
    process.exit(2);
  }

  process.exit(checkReport(reportPath) ? 0 : 1);
}

module.exports = {
  evaluateZapReport,
};
