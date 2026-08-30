const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant offline-code V2 KDF probe remains isolated from normal builds", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-kdf-probe-isolation-check.cjs")],
    { stdio: "pipe" });
});
