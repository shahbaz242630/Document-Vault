const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const coordinatorPath = join(root,
  "services/api/src/claimant/offline-code-v2-proof-attempt-coordinator.ts");
const coordinator = readFileSync(coordinatorPath, "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_PROOF_ATTEMPT_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/u
  .test(coordinator)) throw new Error("Offline-code V2 proof-attempt approval must remain literal false.");
if (index.includes("offline-code-v2-proof-attempt-coordinator"))
  throw new Error("Offline-code V2 proof-attempt coordinator is mounted.");
for (const token of ["@supabase", "createClient", "fetch(", "process.env", "console.",
  "localStorage", "sessionStorage", "indexedDB", "sendEmail", "release_packages"])
  if (coordinator.includes(token)) throw new Error(`Proof-attempt coordinator has runtime coupling: ${token}`);
for (const token of ["clientSecret", "proofPrivateKey", "plaintextMek", "rootSecret",
  "identity_verified: true", "claim_created: true", "release_authorized: true"])
  if (coordinator.includes(token)) throw new Error(`Proof-attempt coordinator contains prohibited authority: ${token}`);

console.log("Claimant offline-code V2 proof-attempt isolation check passed.");
