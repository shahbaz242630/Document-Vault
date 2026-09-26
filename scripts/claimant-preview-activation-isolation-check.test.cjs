const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant Preview gate reads four variables and opens only the W1 routes", () => {
  execFileSync(process.execPath, [join(__dirname, "claimant-preview-activation-isolation-check.cjs")],
    { stdio: "pipe" });
});
