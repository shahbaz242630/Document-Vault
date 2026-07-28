const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildSbomFromPackageLock,
  generateReleaseSbom,
  packageUrl,
  validateSbom,
} = require("./generate-release-sbom.cjs");

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

test("builds a deterministic production inventory from an npm package lock", () => {
  const sbom = buildSbomFromPackageLock(
    {
      name: "example",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: {
        "": { name: "example", version: "1.0.0" },
        "node_modules/@scope/optional": {
          version: "2.0.0",
          optional: true,
        },
        "node_modules/dev-only": {
          version: "3.0.0",
          dev: true,
        },
        "node_modules/production": {
          version: "4.0.0",
        },
        "node_modules/nested/node_modules/production": {
          version: "4.0.0",
          optional: true,
        },
      },
    },
    { timestamp: "2026-07-28T00:00:00.000Z" },
  );

  assert.equal(sbom.metadata.timestamp, "2026-07-28T00:00:00.000Z");
  assert.deepEqual(
    sbom.components.map(({ name, scope }) => ({ name, scope })),
    [
      { name: "@scope/optional", scope: "optional" },
      { name: "production", scope: "required" },
    ],
  );
  assert.equal(sbom.components[0].purl, "pkg:npm/%40scope/optional@2.0.0");
  assert.equal(sbom.metadata.component.purl, "pkg:npm/example@1.0.0");
});

test("writes and validates a release SBOM without invoking npm dependency resolution", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sanduqkin-sbom-"));
  try {
    fs.writeFileSync(
      path.join(cwd, "package-lock.json"),
      JSON.stringify({
        name: "example",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": { name: "example", version: "1.0.0" },
          "node_modules/production": { version: "4.0.0" },
        },
      }),
    );

    const result = generateReleaseSbom({
      cwd,
      timestamp: "2026-07-28T00:00:00.000Z",
    });
    const written = JSON.parse(fs.readFileSync(result.outputPath, "utf8"));

    assert.equal(result.componentCount, 1);
    assert.equal(validateSbom(written), 1);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("rejects unsupported lockfiles and malformed scoped package names", () => {
  assert.throws(
    () => buildSbomFromPackageLock({ lockfileVersion: 1, packages: {} }),
    /v2-or-newer/,
  );
  assert.throws(() => packageUrl("@broken", "1.0.0"), /scoped npm package/);
});
