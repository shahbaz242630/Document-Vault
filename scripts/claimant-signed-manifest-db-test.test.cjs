const assert = require("node:assert/strict");
const test = require("node:test");
const { buildClaimantSignedManifestDbTestSql } = require("./claimant-signed-manifest-db-test.cjs");

test("signed-manifest live fixture uses complete route authority and fresh package dates", () => {
  const sql = buildClaimantSignedManifestDbTestSql();
  assert.ok(sql.includes("insert into public.claimant_invitations"));
  assert.ok(sql.includes("insert into public.claimant_review_interventions(id, case_id, cycle_id"));
  assert.ok(sql.includes("'document_location'"));
  assert.ok(sql.includes("'sanduqkin:claim:recipient-grant:v2'"));
  assert.equal(sql.includes("2026-08-21T10:00:00"), false);
  assert.equal(sql.includes("create role anon"), false);
});

test("standalone signed-manifest fixture retains its isolated schema", () => {
  const sql = buildClaimantSignedManifestDbTestSql({ standalone: true });
  assert.ok(sql.includes("create role anon"));
  assert.equal(sql.includes("insert into public.claimant_invitations"), false);
});
