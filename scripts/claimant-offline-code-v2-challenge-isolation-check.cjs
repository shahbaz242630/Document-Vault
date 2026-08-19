const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const coordinatorPath = join(root,
  "services/api/src/claimant/offline-code-v2-challenge-coordinator.ts");
const migrationPath = join(root,
  "supabase/migrations/20260819084008_offline_code_v2_enumeration_resistant_challenges.sql");
const coordinator = readFileSync(coordinatorPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (!/CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED\s*=\s*false\s+as\s+const/u
  .test(coordinator)) throw new Error("Offline-code V2 challenge approval must remain literal false.");
if (index.includes("offline-code-v2-challenge-coordinator"))
  throw new Error("Offline-code V2 challenge coordinator is mounted.");
for (const token of ["@supabase", "createClient", "fetch(", "process.env", "console.",
  "localStorage", "sessionStorage", "indexedDB", "sendEmail", "release_packages"])
  if (coordinator.includes(token)) throw new Error(`Challenge coordinator has runtime coupling: ${token}`);
for (const token of ["clientSecret", "proofPrivateKey", "plaintextMek", "rootSecret"])
  if (coordinator.includes(token)) throw new Error(`Challenge coordinator accepts prohibited material: ${token}`);
for (const token of ["raw_locator", "network_signal", "device_signal", "ip_address",
  "record_found", "locator_found", "synthetic_challenge"])
  if (migration.includes(token)) throw new Error(`Challenge persistence leaks boundary state: ${token}`);
console.log("Claimant offline-code V2 challenge isolation check passed.");
