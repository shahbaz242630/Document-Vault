const { execFileSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");

function capturePreCleanupFailureEvidence({ dumpUi, sanitizeUiXml }) {
  try {
    mkdirSync("android-smoke-failure", { recursive: true });
  } catch {
    return;
  }

  try {
    const screenshot = execFileSync("adb", ["exec-out", "screencap", "-p"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    writeFileSync("android-smoke-failure/failure-before-cleanup.png", screenshot);
  } catch {
    // Preserve the original smoke failure when screenshot capture is unavailable.
  }

  try {
    const safeUi = sanitizeUiXml(dumpUi());
    writeFileSync("android-smoke-failure/failure-before-cleanup.xml", safeUi, "utf8");
  } catch {
    // Preserve the original smoke failure when UI capture is unavailable.
  }
}

module.exports = { capturePreCleanupFailureEvidence };
