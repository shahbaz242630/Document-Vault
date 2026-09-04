const assert = require("node:assert/strict");
const test = require("node:test");

const { buildOfflineCodeV2HandoffDbTestSql } =
  require("./claimant-offline-code-v2-handoff-db-test.cjs");

test("builds hostile and happy-path authenticated handoff SQL", () => {
  const sql = buildOfflineCodeV2HandoffDbTestSql();
  for (const token of ["cross-account load was accepted", "changed transcript digest was accepted",
    "changed completion replay was accepted", "authenticated role called handoff RPC",
    "CLAIMANT_OFFLINE_CODE_V2_HANDOFF_DB_TEST_PASSED"])
    assert.ok(sql.includes(token), token);
});
