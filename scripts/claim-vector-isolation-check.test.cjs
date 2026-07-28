const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("claim protocol vectors remain synthetic and runtime-disconnected", () => {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "claim-vector-isolation-check.cjs")],
    { encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});
