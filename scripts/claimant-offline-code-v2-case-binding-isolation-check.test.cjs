const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("offline-code V2 case binding stays isolated", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-case-binding-isolation-check.cjs")],
    { stdio: "pipe" });
});
