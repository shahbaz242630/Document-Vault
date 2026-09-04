const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("offline-code V2 authenticated handoff stays isolated", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-handoff-isolation-check.cjs")], { stdio: "pipe" });
});
