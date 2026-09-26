const assert = require("node:assert/strict");
const test = require("node:test");

const { findViolations } = require("./claimant-vercel-env-guard.cjs");

test("claimant variables scoped to the claimant-preview branch pass", () => {
  assert.deepEqual(findViolations("sanduqkin-api", [
    { key: "CLAIMANT_RUNTIME_ENABLED", target: ["preview"], gitBranch: "claimant-preview" },
    { key: "OFFLINE_CODE_V2_LOCATOR_INDEX_KEY", target: ["preview"], gitBranch: "claimant-preview" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", target: ["preview"], gitBranch: "claimant-preview" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", target: ["production"] },
    { key: "ACCOUNT_DELETION_PROCESSOR_TOKEN", target: ["production"] },
  ]), []);
});

test("claimant variables on Production, Development or every Preview fail", () => {
  const violations = findViolations("sanduqkin-api", [
    { key: "CLAIMANT_RUNTIME_ENABLED", target: ["production"] },
    { key: "CLAIMANT_PREVIEW_ACTIVATION", target: ["preview", "production"], gitBranch: "claimant-preview" },
    { key: "OFFLINE_CODE_V2_OWNER_ORIGIN", target: ["development"] },
    { key: "CLAIMANT_OFFLINE_CODE_V2_ENABLED", target: ["preview"] },
    { key: "EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN", target: "production" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", target: ["preview"] },
    { key: "SUPABASE_URL", target: ["preview", "production"] },
  ]);
  assert.equal(violations.length, 7);
});
