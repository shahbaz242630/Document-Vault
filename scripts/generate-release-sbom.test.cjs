const assert = require("node:assert/strict");
const test = require("node:test");

const { validateSbom } = require("./generate-release-sbom.cjs");

test("accepts a CycloneDX SBOM with production components", () => {
  assert.equal(
    validateSbom({
      bomFormat: "CycloneDX",
      components: [{ name: "sanduqkin", type: "application" }],
      specVersion: "1.5",
    }),
    1,
  );
});

test("rejects missing, malformed, or empty release SBOMs", () => {
  assert.throws(() => validateSbom(), /CycloneDX/);
  assert.throws(
    () => validateSbom({ bomFormat: "SPDX", components: [{}], specVersion: "2.3" }),
    /CycloneDX/,
  );
  assert.throws(
    () => validateSbom({ bomFormat: "CycloneDX", components: [], specVersion: "1.5" }),
    /production components/,
  );
});
