const assert = require("node:assert/strict");
const test = require("node:test");
const { buildOfflineCodeV2OwnerListDbTestSql } = require("./claimant-offline-code-v2-owner-list-db-test.cjs");

test("live owner-list fixture checks ownership, order, status, fields and role denial", () => {
  const sql = buildOfflineCodeV2OwnerListDbTestSql();
  for (const token of ["list did not return only the owner''s sheets, newest first", "list statuses were wrong",
    "list exposed a field outside the allowed set", "listing changed a row", "an unknown owner saw sheets",
    "authenticated role called the owner list", "anon role called the owner list", "set local role service_role"])
    assert.ok(sql.includes(token), token);
  assert.equal(sql.includes("create function public.claimant_list_offline_code_v2_locators"), false);
});

test("standalone owner-list fixture applies the persistence, challenge and list migrations first", () => {
  const sql = buildOfflineCodeV2OwnerListDbTestSql({ standalone: true });
  const table = sql.indexOf("create table public.claimant_offline_code_v2_locators");
  const salt = sql.indexOf("add column kdf_salt");
  const list = sql.indexOf("create function public.claimant_list_offline_code_v2_locators");
  assert.ok(table >= 0 && table < salt && salt < list && list < sql.indexOf("do $test$"));
});
