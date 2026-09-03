const assert = require("node:assert/strict");
const test = require("node:test");
const { buildOfflineCodeV2PersistenceDbTestSql } =
  require("./claimant-offline-code-v2-persistence-db-test.cjs");

test("live persistence fixture calls the current registration and challenge signatures", () => {
  const sql = buildOfflineCodeV2PersistenceDbTestSql();
  for (const [name, count] of [["register_offline_code_v2_locator", 14],
    ["issue_offline_code_v2_challenge", 6]]) {
    const calls = [...sql.matchAll(new RegExp(`public\\.claimant_${name}\\(([^)]*)\\)`, "g"))];
    assert.ok(calls.length > 1);
    for (const call of calls) assert.equal(call[1].split(",").length, count);
  }
  assert.ok(sql.includes("#>> '{challenge,challenge_id}'"));
  assert.ok(sql.includes("->> 'challenge_bytes_digest'"));
  assert.ok(sql.includes("five failures did not lock the locator"));
  assert.ok(sql.includes("locked or unknown locator exposed availability or persisted a challenge"));
  assert.ok(sql.includes("issued challenge replay changed after revocation"));
  assert.equal(sql.includes("create table public.claimant_offline_code_v2_rate_limits"), false);
});

test("standalone persistence fixture applies both migrations before using the current API", () => {
  const sql = buildOfflineCodeV2PersistenceDbTestSql({ standalone: true });
  assert.ok(sql.includes("create table public.claimant_offline_code_v2_locators"));
  assert.ok(sql.includes("create table public.claimant_offline_code_v2_rate_limits"));
  assert.ok(sql.indexOf("add column kdf_salt") < sql.indexOf("do $test$"));
});
