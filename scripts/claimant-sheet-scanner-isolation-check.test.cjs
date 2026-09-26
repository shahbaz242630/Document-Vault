const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant sheet scanner reads QR codes only and keeps nothing", () => {
  execFileSync(process.execPath, [join(__dirname, "claimant-sheet-scanner-isolation-check.cjs")],
    { stdio: "pipe" });
});
