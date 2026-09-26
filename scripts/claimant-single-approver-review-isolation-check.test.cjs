const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("single-approver review stays literal false, unmounted and without bypass", () => {
  execFileSync(process.execPath, [join(__dirname, "claimant-single-approver-review-isolation-check.cjs")],
    { stdio: "pipe" });
});
