const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

test("claimant submission client remains disabled, safe, and runtime-disconnected", () => {
  const result = spawnSync(process.execPath,
    [join(__dirname, "claimant-submission-client-isolation-check.cjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
});
