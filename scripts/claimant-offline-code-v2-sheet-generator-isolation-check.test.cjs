const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant offline-code V2 sheet generator remains false, synthetic and unmounted", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-sheet-generator-isolation-check.cjs")],
    { stdio: "pipe" });
});
