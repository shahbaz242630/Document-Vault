const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const runner = readFileSync(join(root, "services/api/scripts",
  "offline-code-v2-database-acceptance-test.ts"), "utf8");
const workflow = readFileSync(join(root, ".github/workflows/security-ci.yml"), "utf8");
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const apiPackage = JSON.parse(readFileSync(join(root, "services/api/package.json"), "utf8"));

test("keeps database acceptance synthetic, loopback-only, and separately invoked", () => {
  assert.match(runner, /SANDUQKIN_LOCAL_SUPABASE_ACCEPTANCE/u);
  assert.match(runner, /assertLoopback\(supabaseUrl\)/u);
  assert.match(runner, /\["127\.0\.0\.1", "localhost", "::1"\]/u);
  assert.match(runner, /test-vectors\/claim\/offline-code-v2\.json/u);
  assert.match(runner, /productionRuntime: false/u);
  assert.match(runner, /createOfflineCodeV2Lifecycle/u);
  assert.match(runner, /createOfflineCodeV2Controller/u);
  assert.match(runner, /createOfflineCodeV2PersistenceTransactionClient/u);
  assert.match(runner, /claimant_offline_code_v2_attempts/u);
  assert.match(runner, /exerciseConcurrentRegistration/u);
  assert.match(runner, /exerciseUnknownLimiter/u);
  assert.match(runner, /exerciseExpiry/u);
  assert.match(runner, /exerciseRls/u);
  assert.doesNotMatch(runner, /SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/u);
  assert.equal(rootPackage.scripts["check:claimant-offline-code-v2-database-acceptance"],
    "npm run test:offline-code-v2-database --workspace @vault/api");
  assert.equal(apiPackage.scripts["test:offline-code-v2-database"],
    "tsx scripts/offline-code-v2-database-acceptance-test.ts");
});

test("runs database acceptance only after migrations and SQL boundary tests", () => {
  const apply = workflow.indexOf("Apply local Supabase migrations");
  const challenge = workflow.indexOf("Claimant offline-code V2 challenge test");
  const acceptance = workflow.indexOf("Claimant offline-code V2 database acceptance");
  const rls = workflow.indexOf("Live RLS attack test");
  assert.ok(apply >= 0 && apply < challenge && challenge < acceptance && acceptance < rls);
  const section = workflow.slice(acceptance, rls);
  assert.match(section, /SANDUQKIN_LOCAL_SUPABASE_ACCEPTANCE: "1"/u);
});
