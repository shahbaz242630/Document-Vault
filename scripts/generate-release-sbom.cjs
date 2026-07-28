const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join("artifacts", "sanduqkin.cdx.json");
const LOCKFILE_PATH = "package-lock.json";

function packageNameFromLockPath(lockPath, details) {
  if (typeof details.name === "string" && details.name) {
    return details.name;
  }

  const match = lockPath.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
  return match?.[1];
}

function packageUrl(name, version) {
  const encodedVersion = encodeURIComponent(version);

  if (name.startsWith("@")) {
    const [scope, packageName] = name.split("/");
    if (!scope || !packageName) {
      throw new Error(`Invalid scoped npm package name: ${name}`);
    }
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodedVersion}`;
  }

  return `pkg:npm/${encodeURIComponent(name)}@${encodedVersion}`;
}

function buildSbomFromPackageLock(packageLock, options = {}) {
  if (
    !packageLock ||
    !Number.isInteger(packageLock.lockfileVersion) ||
    packageLock.lockfileVersion < 2 ||
    !packageLock.packages ||
    typeof packageLock.packages !== "object"
  ) {
    throw new Error("Release SBOM requires an npm v2-or-newer package lock.");
  }

  const root = packageLock.packages[""] ?? {};
  const rootName = root.name ?? packageLock.name;
  const rootVersion = root.version ?? packageLock.version;
  if (typeof rootName !== "string" || typeof rootVersion !== "string") {
    throw new Error("Release SBOM package lock must declare the root name and version.");
  }

  const components = new Map();
  for (const [lockPath, details] of Object.entries(packageLock.packages)) {
    if (
      lockPath === "" ||
      !details ||
      typeof details !== "object" ||
      details.dev === true
    ) {
      continue;
    }

    const name = packageNameFromLockPath(lockPath, details);
    const version = details.version;
    if (typeof name !== "string" || typeof version !== "string") {
      continue;
    }

    const purl = packageUrl(name, version);
    const existing = components.get(purl);
    if (!existing) {
      components.set(purl, {
        type: "library",
        "bom-ref": purl,
        name,
        version,
        scope: details.optional === true ? "optional" : "required",
        purl,
      });
    } else if (details.optional !== true) {
      existing.scope = "required";
    }
  }

  const rootPurl = packageUrl(rootName, rootVersion);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      timestamp: options.timestamp ?? new Date().toISOString(),
      component: {
        type: "application",
        "bom-ref": rootPurl,
        name: rootName,
        version: rootVersion,
        purl: rootPurl,
      },
      properties: [
        {
          name: "sanduqkin:inventory-source",
          value: "npm-package-lock-v3",
        },
        {
          name: "sanduqkin:dependency-scope",
          value: "production",
        },
      ],
    },
    components: [...components.values()].sort((left, right) =>
      left.purl.localeCompare(right.purl),
    ),
  };
}

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
  const lockfilePath = path.join(cwd, options.lockfilePath ?? LOCKFILE_PATH);
  const packageLock = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  const sbom = buildSbomFromPackageLock(packageLock, options);
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
  buildSbomFromPackageLock,
  generateReleaseSbom,
  packageUrl,
  validateSbom,
};
