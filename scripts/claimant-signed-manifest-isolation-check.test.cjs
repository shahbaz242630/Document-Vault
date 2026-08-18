const test = require("node:test");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
test("claimant signed-manifest foundation remains disabled and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-signed-manifest-isolation-check.cjs")], { stdio: "pipe" });
});
