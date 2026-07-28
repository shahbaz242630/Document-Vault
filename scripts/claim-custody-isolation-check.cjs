const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { extname, join } = require("node:path");

const repositoryRoot = join(__dirname, "..");
const featureDirectory = join(
  repositoryRoot,
  "apps",
  "mobile",
  "src",
  "features",
  "claimant-custody",
);
const moduleDirectory = join(
  repositoryRoot,
  "apps",
  "mobile",
  "modules",
  "claimant-key-custody",
);

for (const directory of [featureDirectory, moduleDirectory]) {
  if (!existsSync(directory)) {
    throw new Error(`Claimant custody probe directory is missing: ${directory}`);
  }
}

const sources = [
  ...sourceFiles(featureDirectory),
  ...sourceFiles(moduleDirectory),
];
const forbiddenRuntimeTokens = [
  "@supabase",
  "createClient(",
  "fetch(",
  "axios",
  "recipient_public_keys",
  "recipient_invitations",
  "release_packages",
  "notification_outbox",
  "localStorage",
  "sessionStorage",
  "AsyncStorage",
  "expo-secure-store",
];

for (const path of sources) {
  const source = readFileSync(path, "utf8");
  for (const token of forbiddenRuntimeTokens) {
    if (source.includes(token)) {
      throw new Error(
        `Claimant custody probe source ${path} contains forbidden runtime token ${token}.`,
      );
    }
  }
  if (!path.endsWith(".test.ts")) {
    for (const resultField of ["private_key", "private_key_bytes", "shared_secret"]) {
      const quotedField = new RegExp(`["']${resultField}["']\\s*[:=]`);
      if (quotedField.test(source)) {
        throw new Error(
          `Claimant custody probe source ${path} exposes prohibited result field ${resultField}.`,
        );
      }
    }
  }
}

const featureSource = readFileSync(
  join(featureDirectory, "custody-probe.ts"),
  "utf8",
);
if (!/CLAIMANT_CUSTODY_PROBE_ENABLED\s*=\s*false\s+as\s+const/.test(featureSource)) {
  throw new Error("Claimant custody probe is not hard-disabled.");
}

for (const path of [
  ...sourceFiles(join(repositoryRoot, "apps", "mobile", "app")),
  ...sourceFiles(join(repositoryRoot, "apps", "mobile", "src")).filter(
    (path) => !path.startsWith(featureDirectory),
  ),
]) {
  const source = readFileSync(path, "utf8");
  if (
    source.includes("claimant-key-custody") ||
    source.includes("features/claimant-custody")
  ) {
    throw new Error(`Claimant runtime source imports the custody probe: ${path}`);
  }
}

for (const nativeSource of [
  join(moduleDirectory, "ios", "ClaimantKeyCustodyModule.swift"),
  join(
    moduleDirectory,
    "android",
    "src",
    "main",
    "java",
    "com",
    "sanduqkin",
    "claimantkeycustody",
    "ClaimantKeyCustodyModule.kt",
  ),
]) {
  const source = readFileSync(nativeSource, "utf8");
  if (!source.includes("probe-only")) {
    throw new Error(`Native custody source lacks a probe-only key alias: ${nativeSource}`);
  }
}

function sourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const result = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (
      [".ts", ".tsx", ".swift", ".kt", ".json", ".gradle", ".xml", ".podspec"].includes(
        extname(path),
      )
    ) {
      result.push(path);
    }
  }
  return result;
}
