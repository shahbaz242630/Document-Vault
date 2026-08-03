const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
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

test("claim contract isolation discovers nested production sources", () => {
  const directory = mkdtempSync(join(tmpdir(), "sanduqkin-claim-contracts-"));
  try {
    const nested = join(directory, "nested");
    mkdirSync(nested);
    writeFileSync(join(directory, "top-level.ts"), "export const top = true;\n");
    writeFileSync(join(nested, "contract.ts"), "export const nested = true;\n");
    writeFileSync(join(nested, "contract.test.ts"), "test('ignored', () => {});\n");

    const { collectContractFiles } = require("./claim-vector-isolation-check.cjs");
    expectPathsEqual(collectContractFiles(directory), [
      join(nested, "contract.ts"),
      join(directory, "top-level.ts"),
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function expectPathsEqual(actual, expected) {
  assert.deepEqual([...actual].sort(), [...expected].sort());
}
