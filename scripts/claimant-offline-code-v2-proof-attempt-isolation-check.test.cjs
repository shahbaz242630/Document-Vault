const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant offline-code V2 proof-attempt coordinator remains false and unmounted", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-proof-attempt-isolation-check.cjs")],
    { stdio: "pipe" });
});
