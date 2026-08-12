const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const controller = readFileSync(join(root, "services", "api", "src", "claimant",
  "claimant-upload-controller.ts"), "utf8");
const processor = readFileSync(join(root, "services", "api", "src", "claimant",
  "claimant-upload-processor.ts"), "utf8");
const synthetic = readFileSync(join(root, "services", "api", "src", "claimant",
  "claimant-upload-synthetic-adapters.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");
const quarantineMigration = readFileSync(join(root, "supabase", "migrations",
  "20260812230000_claimant_private_evidence_quarantine.sql"), "utf8");

requireMatch(controller, /CLAIMANT_UPLOAD_CONTROLLER_APPROVED\s*=\s*false\s+as\s+const/u,
  "Upload controller approval must remain a literal false.");
requireMatch(processor, /CLAIMANT_UPLOAD_PROCESSOR_APPROVED\s*=\s*false\s+as\s+const/u,
  "Upload processor approval must remain a literal false.");
requireMatch(synthetic, /CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED\s*=\s*false\s+as\s+const/u,
  "Synthetic upload adapters must remain disabled by default.");
requireMatch(controller, /requireClaimantCapability\([^;]+"evidenceUpload"\)/u,
  "The controller must retain the evidence-upload runtime capability gate.");
for (const token of ["requireFreshClaimantAssurance", ".portal.assert(",
  "X-Claimant-Upload-Capability", "Content-Length", "context.req.raw.body",
  "new URL(context.req.url).origin === config.apiOrigin"]) {
  if (!controller.includes(token)) throw new Error(`Upload controller lost boundary token: ${token}`);
}
if (!processor.includes("transactions.reconcile")) {
  throw new Error("Upload processor lost its database-authority preflight.");
}
for (const path of ["upload-capabilities", "objects/:objectId", "objects/:objectId/reconcile"]) {
  if (!index.includes(path)) throw new Error(`Concealed upload route is missing: ${path}`);
}
for (const forbidden of ["console.", "arrayBuffer()", "formData()", "filename", "fileName",
  "@aws-sdk", "@google-cloud", "@azure/storage", "clamav", "virusTotal"]) {
  if (controller.includes(forbidden)) throw new Error(`Upload controller contains forbidden token: ${forbidden}`);
}
if (index.includes("claimant-upload-synthetic-adapters")) {
  throw new Error("Synthetic upload adapters must never be wired by the API entrypoint.");
}
const capabilityDigestStatement = quarantineMigration.match(
  /v_request_digest := encode\([\s\S]*?select \* into v_existing/u,
)?.[0] ?? "";
if (!capabilityDigestStatement || capabilityDigestStatement.includes("p_expires_at")) {
  throw new Error("Capability retry identity must not drift with controller wall-clock expiry.");
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}
