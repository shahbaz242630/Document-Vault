const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant retrieval access control remains disabled and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-retrieval-access-control-isolation-check.cjs")], { stdio: "pipe" });
});
