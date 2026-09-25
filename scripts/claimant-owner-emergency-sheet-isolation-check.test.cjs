const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant owner emergency sheet remains false, in memory and behind the vault session", () => {
  execFileSync(process.execPath, [join(__dirname, "claimant-owner-emergency-sheet-isolation-check.cjs")],
    { stdio: "pipe" });
});
