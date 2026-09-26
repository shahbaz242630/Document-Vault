const assert = require("node:assert/strict");
const test = require("node:test");

const { compareMigrations } = require("./claimant-preview-hosted-catalog-check.cjs");

test("hosted migrations must match the local list exactly", () => {
  assert.deepEqual(compareMigrations(["1", "2"], ["1", "2"]), { missing: [], unknown: [] });
  assert.deepEqual(compareMigrations(["1", "2", "3"], ["1", "4"]), { missing: ["2", "3"], unknown: ["4"] });
});

const { isHardenedPlatformFunction } = require("./claimant-preview-hosted-catalog-check.cjs");

test("the platform rls_auto_enable function is accepted only while no API role can execute it", () => {
  const violation = { rule: "public-function-no-security-definer", function: "rls_auto_enable" };
  const revoked = { functionPrivileges: [{ functionName: "rls_auto_enable", roleName: "anon", hasPrivilege: false },
    { functionName: "rls_auto_enable", roleName: "authenticated", hasPrivilege: false }] };
  assert.equal(isHardenedPlatformFunction(violation, revoked), true);
  assert.equal(isHardenedPlatformFunction(violation, { functionPrivileges: [
    { functionName: "rls_auto_enable", roleName: "anon", hasPrivilege: true }] }), false);
  assert.equal(isHardenedPlatformFunction(violation, { functionPrivileges: [] }), false);
  assert.equal(isHardenedPlatformFunction({ ...violation, function: "other" }, revoked), false);
});
