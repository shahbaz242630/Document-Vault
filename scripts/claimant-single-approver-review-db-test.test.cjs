const assert = require("node:assert/strict");
const test = require("node:test");
const { buildClaimantSingleApproverReviewDbTestSql } = require("./claimant-single-approver-review-db-test.cjs");

test("live single-approver fixture covers the happy path and every refusal", () => {
  const sql = buildClaimantSingleApproverReviewDbTestSql();
  for (const token of ["decision without precheck was accepted", "two-person round opened for a single-approver policy",
    "short cooldown did not block", "blocking precheck was overridden", "non-human approver was accepted",
    "changed decision replay was accepted", "release before notice was accepted",
    "release precheck ignored the running window", "stranger held the approval", "held approval was released",
    "owner-cancelled approval was released", "grant change did not block release",
    "stale re-confirmation was accepted", "a different authorizer released the approval",
    "a decision pre-check was used for release", "release replay was unstable", "audit chain did not verify",
    "audit export was unsafe", "edited event was not detected", "deleted chain entry was not detected",
    "authenticated role ran a precheck", "CLAIMANT_SINGLE_APPROVER_REVIEW_DB_TEST_PASSED"])
    assert.ok(sql.includes(token), token);
  assert.ok(sql.startsWith("begin;") && sql.includes("reset role; rollback;"));
  assert.equal(sql.includes("create function"), false);
});
