const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join("artifacts", "sanduqkin.cdx.json");
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function validateSbom(sbom) {
  if (!sbom || sbom.bomFormat !== "CycloneDX") {
    throw new Error("Release SBOM must use the CycloneDX format.");
  }

  if (typeof sbom.specVersion !== "string" || !sbom.specVersion) {
    throw new Error("Release SBOM must declare a CycloneDX spec version.");
  }

  if (!Array.isArray(sbom.components) || sbom.components.length === 0) {
    throw new Error("Release SBOM must contain production components.");
  }

  return sbom.components.length;
}

function generateReleaseSbom(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const npmCli = options.npmCli ?? process.env.npm_execpath;

  if (!npmCli) {
    throw new Error("Run SBOM generation through `npm run sbom:release`.");
  }

  const result = spawnSync(
    process.execPath,
    [
      npmCli,
      "sbom",
      "--package-lock-only",
      "--sbom-format=cyclonedx",
      "--sbom-type=application",
      "--omit=dev",
      "--workspaces",
    ],
    {
      cwd,
      encoding: "utf8",
      // Expo's current lockfile contains a known peer-range mismatch between
      // expo-modules-core and react-native-worklets. npm can inventory the
      // resolved production tree safely when peer re-resolution is disabled.
      env: {
        ...process.env,
        NPM_CONFIG_LEGACY_PEER_DEPS: "true",
      },
      maxBuffer: MAX_OUTPUT_BYTES,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm sbom failed: ${String(result.stderr).trim()}`);
  }

  const sbom = JSON.parse(result.stdout);
  const componentCount = validateSbom(sbom);
  const outputPath = path.join(cwd, OUTPUT_PATH);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return { componentCount, outputPath };
}

if (require.main === module) {
  const result = generateReleaseSbom();
  console.log(`Release SBOM contains ${result.componentCount} production components.`);
  console.log(`Release SBOM written to ${OUTPUT_PATH}.`);
}

module.exports = {
  generateReleaseSbom,
  validateSbom,
};
