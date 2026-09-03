const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant native package opening remains disabled and runtime-disconnected", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-native-package-open-isolation-check.cjs")], { stdio: "pipe" });
});
