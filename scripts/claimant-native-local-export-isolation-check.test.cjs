const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant native local export remains disabled and runtime-disconnected", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-native-local-export-isolation-check.cjs")], { stdio: "pipe" });
});
