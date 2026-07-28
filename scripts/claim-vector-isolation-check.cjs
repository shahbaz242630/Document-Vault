const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const repositoryRoot = join(__dirname, "..");
const contractDirectory = join(
  repositoryRoot,
  "packages",
  "shared-types",
  "src",
  "claim",
);
const vectorDirectory = join(
  repositoryRoot,
  "packages",
  "shared-types",
  "test-vectors",
  "claim",
);

const forbiddenContractTokens = [
  "@supabase",
  "fetch(",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "process.env",
  "sendEmail",
  "notification_outbox",
  "release_packages",
];

for (const filename of readdirSync(contractDirectory)) {
  if (
    !filename.endsWith(".ts") ||
    filename.endsWith(".test.ts")
  ) {
    continue;
  }
  const source = readFileSync(join(contractDirectory, filename), "utf8");
  for (const token of forbiddenContractTokens) {
    if (source.includes(token)) {
      throw new Error(
        `Claim protocol contract ${filename} contains forbidden runtime token ${token}.`,
      );
    }
  }
}

const expectedVectors = [
  "recipient-grant-v1.json",
  "recipient-grant-v2.json",
  "offline-code-v2.json",
  "claim-state-v1.json",
  "release-package-v1.json",
];

for (const filename of expectedVectors) {
  const value = JSON.parse(
    readFileSync(join(vectorDirectory, filename), "utf8"),
  );
  if (
    value.meta?.synthetic_only !== true ||
    value.meta?.production_data !== false
  ) {
    throw new Error(`${filename} is not explicitly marked synthetic-only.`);
  }
}

const offline = JSON.parse(
  readFileSync(join(vectorDirectory, "offline-code-v2.json"), "utf8"),
);
if (offline.kdf_profile?.production_approved !== false) {
  throw new Error("The V2 synthetic KDF profile must not claim production approval.");
}

const claimantPortalSource = readFileSync(
  join(repositoryRoot, "apps", "web", "lib", "claimant-portal.ts"),
  "utf8",
);
for (const capability of [
  "authentication",
  "claimIntake",
  "emergencyCodeEntry",
  "evidenceUpload",
  "localClaimantDecryption",
  "review",
  "release",
]) {
  if (
    !new RegExp(`${capability}:\\s*false`).test(claimantPortalSource)
  ) {
    throw new Error(`Claimant capability ${capability} is not hard-disabled.`);
  }
}
