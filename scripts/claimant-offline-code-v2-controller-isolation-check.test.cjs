const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant offline-code V2 controller remains false, concealed, and possession-only", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-controller-isolation-check.cjs")],
    { stdio: "pipe" });
});
