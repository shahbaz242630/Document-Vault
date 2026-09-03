const assert = require("node:assert/strict");
const test = require("node:test");

const { buildOfflineCodeV2CaseBindingDbTestSql } = require(
  "./claimant-offline-code-v2-case-binding-db-test.cjs");

test("database exercise covers binding, replay, session freshness, tenant race, and role denial", () => {
  const sql = buildOfflineCodeV2CaseBindingDbTestSql();
  for (const token of ["claimant_bind_offline_code_v2_case", "case binding replay was unstable",
    "changed idempotency input was accepted", "verified challenge rebound to another account",
    "displaced portal session was accepted", "non-verified challenge was accepted",
    "revoked locator was accepted", "stale portal session was accepted",
    "stale proof was accepted", "expired locator was accepted", "locked locator was accepted",
    "owner self-binding was accepted", "mismatched commitment was accepted",
    "null input 0 was accepted", "null input 7 was accepted",
    "null route locator_version was accepted", "anonymous role called case binding RPC",
    "authenticated role read offline-code case",
    "authenticated role called case binding RPC", "release_authorized"])
    assert.ok(sql.includes(token), token);
});
