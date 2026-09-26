const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const servicePath = "services/api/src/claimant/single-approver-review-service.ts";
const clientPath = "services/api/src/claimant/single-approver-review-transaction-client.ts";
const service = readFileSync(join(root, servicePath), "utf8");
const client = readFileSync(join(root, clientPath), "utf8");

// Slice 7A: one accountable human approver, unmounted and literal false; nothing can bypass the safeguards.
if (!/CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED\s*=\s*false\s+as\s+const/u.test(service))
  throw new Error("Single-approver review approval must remain literal false.");
for (const token of ["fetch(", "process.env", "localStorage", "console.", "override", "skipPrecheck",
  "evidence_bytes", "signed_url", "sendEmail", "resend", "postmark", "twilio", "openai", "anthropic",
  "live_review_authority: true", "live_release_authority: true", "import("])
  if (service.includes(token) || client.includes(token))
    throw new Error(`Single-approver review boundary contains forbidden token: ${token}`);
for (const token of ["guard(precheck", "guard(decision", "guard(notice", "guard(hold", "guard(release",
  "(input.approved ?? CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED)"])
  if (!service.includes(token)) throw new Error(`Single-approver review service lost a guard: ${token}`);

// Only the service may use the transaction client, and nothing mounted may use either.
for (const file of sourceFiles(join(root, "services/api/src"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (/\.test\.ts$/u.test(path) || path === servicePath || path === clientPath) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes("single-approver-review-service") || source.includes("single-approver-review-transaction-client"))
    throw new Error(`Single-approver review foundation must remain unmounted: ${path}`);
}

console.log("Claimant single-approver review isolation passed.");

function sourceFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...sourceFiles(path));
    else if (entry.endsWith(".ts")) output.push(path);
  }
  return output;
}
