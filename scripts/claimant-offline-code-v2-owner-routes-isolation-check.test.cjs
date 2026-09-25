const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant offline-code V2 owner routes remain false, owner-bound and single-indexed", () => {
  execFileSync(process.execPath,
    [join(__dirname, "claimant-offline-code-v2-owner-routes-isolation-check.cjs")],
    { stdio: "pipe" });
});
