const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant retrieval lifecycle closure remains disabled and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-retrieval-lifecycle-closure-isolation-check.cjs")], { stdio: "pipe" });
});
