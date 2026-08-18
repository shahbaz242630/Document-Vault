const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant owner-notice delivery remains disabled, provider-free, and unmounted", () => {
  execFileSync(process.execPath, [join(__dirname,
    "claimant-owner-notice-delivery-isolation-check.cjs")], { encoding: "utf8" });
});
