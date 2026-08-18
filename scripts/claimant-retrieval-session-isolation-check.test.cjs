const test = require("node:test");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
test("claimant retrieval-session foundation remains disabled and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-retrieval-session-isolation-check.cjs")], { stdio: "pipe" });
});
