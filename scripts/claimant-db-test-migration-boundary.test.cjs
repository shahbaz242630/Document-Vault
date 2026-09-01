const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const builders = [
  require("./claimant-encrypted-package-delivery-db-test.cjs")
    .buildClaimantEncryptedPackageDeliveryDbTestSql,
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

test("database tests do not replay migrations after CI applies the catalog", () => {
  for (const build of builders) {
    assert.doesNotMatch(build(), /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
    assert.match(build({ standalone: true }),
      /create\s+(?:or\s+replace\s+)?function\s+public\./iu);
  }

  for (const name of [
    "claimant-native-enrollment-reconciliation-db-test.cjs",
    "claimant-intake-foundation-db-test.cjs",
    "claimant-evidence-preparation-db-test.cjs",
  ]) {
    const source = readFileSync(join(__dirname, name), "utf8");
    assert.doesNotMatch(source, /supabase\/migrations\//u);
  }
});
