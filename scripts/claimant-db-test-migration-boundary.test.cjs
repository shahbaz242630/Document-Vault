const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const builders = [
  require("./claimant-encrypted-package-delivery-db-test.cjs")
    .buildClaimantEncryptedPackageDeliveryDbTestSql,
  require("./claimant-independent-review-db-test.cjs")
    .buildClaimantIndependentReviewDbTestSql,
  require("./claimant-retrieval-completion-db-test.cjs")
    .buildClaimantRetrievalCompletionDbTestSql,
  require("./claimant-retrieval-access-control-db-test.cjs").buildSuspensionSql,
  require("./claimant-retrieval-access-control-db-test.cjs").buildExpirySql,
  require("./claimant-retrieval-lifecycle-closure-db-test.cjs").buildClosureSql,
  require("./claimant-offline-code-v2-persistence-db-test.cjs")
    .buildOfflineCodeV2PersistenceDbTestSql,
  require("./claimant-offline-code-v2-challenge-db-test.cjs")
    .buildOfflineCodeV2ChallengeDbTestSql,
];
const buildReviewerAssignment = require("./claimant-reviewer-assignment-db-test.cjs")
  .buildClaimantReviewerAssignmentDbTestSql;

test("database tests do not replay migrations after CI applies the catalog", () => {
  for (const build of builders) {
    assert.doesNotMatch(build(), /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
    assert.match(build({ standalone: true }),
      /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
  }
  assert.doesNotMatch(buildReviewerAssignment(),
    /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
  assert.match(buildReviewerAssignment({ includeMigrations: true }),
    /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
  const independentReview = builders[1]();
  assert.doesNotMatch(independentReview, /insert\s+into\s+public\.claimant_cases\s+values/iu);
  assert.match(independentReview, /insert\s+into\s+public\.claimant_cases\s*\(/iu);
  const independentReviewSource = readFileSync(join(__dirname,
    "claimant-independent-review-db-test.cjs"), "utf8");
  assert.match(independentReviewSource,
    /'v1\/\$\{id\.case\}\/\$\{id\.capability\}'/u,
    "the live upload fixture must bind object_path to the capability id");
  assert.doesNotMatch(independentReviewSource,
    /'v1\/\$\{id\.case\}\/\$\{id\.object\}'/u,
    "the live upload fixture must not bind object_path to a separate object id");
  assert.match(independentReviewSource,
    /values \('\$\{id\.capability\}', '\$\{id\.capability\}', '\$\{id\.case\}'/u,
    "the live evidence object must share the capability id");

  for (const name of [
    "claimant-native-enrollment-reconciliation-db-test.cjs",
    "claimant-intake-foundation-db-test.cjs",
    "claimant-evidence-preparation-db-test.cjs",
    "claimant-private-quarantine-db-test.cjs",
  ]) {
    const source = readFileSync(join(__dirname, name), "utf8");
    assert.doesNotMatch(source, /supabase\/migrations\//u);
  }
});
