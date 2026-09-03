const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant encrypted-package delivery remains disabled and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-encrypted-package-delivery-isolation-check.cjs")], { stdio: "pipe" });
});
