const assert = require("node:assert/strict");
const test = require("node:test");
const { buildClaimantRetrievalSessionDbTestSql } =
  require("./claimant-retrieval-session-db-test.cjs");
const { buildClaimantEncryptedPackageDeliveryDbTestSql } =
  require("./claimant-encrypted-package-delivery-db-test.cjs");
const { buildClaimantRetrievalCompletionDbTestSql } =
  require("./claimant-retrieval-completion-db-test.cjs");
const { buildExpirySql, buildSuspensionSql } =
  require("./claimant-retrieval-access-control-db-test.cjs");
const { buildClosureSql } = require("./claimant-retrieval-lifecycle-closure-db-test.cjs");

test("retrieval-session live fixture includes the full invitation and authority chain", () => {
  const sql = buildClaimantRetrievalSessionDbTestSql();
  assert.ok(sql.includes("insert into public.claimant_invitations"));
  assert.ok(sql.includes("current_key_id"));
  assert.ok(sql.includes("'sanduqkin:claim:recipient-grant:v2'"));
  assert.ok(sql.includes("claimant_review_resolution_authorities"));
  assert.ok(sql.includes("claimant_review_interventions(id, case_id, cycle_id, review_round_id"));
  assert.ok(sql.includes("set status = 'revoked', revoked_at = now()"));
  assert.ok(sql.includes("claimant_portal_eligibilities(user_id, status, source)"));
  assert.ok(sql.includes("claimant_portal_session_controls(user_id, active_session_id, status"));
  assert.equal(sql.includes("create role anon"), false);
});

test("standalone retrieval fixtures retain their isolated schema and revocation shape", () => {
  for (const build of [buildClaimantRetrievalSessionDbTestSql,
    buildClaimantEncryptedPackageDeliveryDbTestSql]) {
    const sql = build({ standalone: true });
    assert.ok(sql.includes("create role anon"));
    assert.equal(sql.includes("insert into public.claimant_invitations"), false);
    assert.ok(sql.includes("set status = 'revoked'"));
    assert.equal(sql.includes("set status = 'revoked', revoked_at = now()"), false);
  }
});

test("delivery live fixture uses valid asset, grant, revocation, and intervention fields", () => {
  const sql = buildClaimantEncryptedPackageDeliveryDbTestSql();
  assert.ok(sql.includes("'document_location'"));
  assert.equal(sql.includes("'document'"), false);
  assert.ok(sql.includes("owner_ephemeral_public_key = repeat('E', 87)"));
  assert.ok(sql.includes("nonce = repeat('G', 32)"));
  assert.ok(sql.includes("set status = 'revoked', revoked_at = now()"));
  assert.ok(sql.includes("claimant_review_interventions(id, case_id, cycle_id, review_round_id"));
  assert.ok(sql.includes("authority.id = release_auth.authority_identity_id"));
});

test("downstream retrieval gates inherit the complete live setup", () => {
  for (const build of [buildClaimantRetrievalCompletionDbTestSql, buildExpirySql,
    buildSuspensionSql, (options) => buildClosureSql(options, false),
    (options) => buildClosureSql(options, true)]) {
    const sql = build({});
    assert.ok(sql.includes("insert into public.claimant_invitations"));
    assert.ok(sql.includes("'document_location'"));
    assert.ok(sql.includes("owner_ephemeral_public_key = repeat('E', 87)"));
  }
});
