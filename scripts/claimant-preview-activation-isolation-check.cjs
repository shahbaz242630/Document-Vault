const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

// Staging wiring W1: one server-side Preview gate, reading exactly four variables, imported only by the W1 files.
const root = join(__dirname, "..");
const gatePath = "services/api/src/claimant/preview-activation.ts";
const gate = readFileSync(join(root, gatePath), "utf8");
const allowedImporters = new Set([
  "services/api/src/claimant/offline-code-v2-controller.ts",
  "services/api/src/claimant/offline-code-v2-owner-routes.ts",
  "services/api/src/claimant/portal-session-routes.ts",
  "services/api/src/claimant/runtime-config.ts",
]);

const readVariables = [...gate.matchAll(/env\.([A-Z_]+)/gu)].map((match) => match[1]).sort();
const expectedVariables = ["CLAIMANT_PREVIEW_ACTIVATION", "VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF"];
if (JSON.stringify(readVariables) !== JSON.stringify(expectedVariables))
  throw new Error(`Claimant Preview gate must read exactly ${expectedVariables.join(", ")}.`);
for (const token of ['env.VERCEL === "1"', 'env.VERCEL_ENV === "preview"',
  "env.VERCEL_GIT_COMMIT_REF === CLAIMANT_PREVIEW_BRANCH", "env.CLAIMANT_PREVIEW_ACTIVATION === CLAIMANT_PREVIEW_ACTIVATION_VALUE",
  'CLAIMANT_PREVIEW_BRANCH = "claimant-preview" as const', 'CLAIMANT_PREVIEW_ACTIVATION_VALUE = "synthetic-only" as const'])
  if (!gate.includes(token)) throw new Error(`Claimant Preview gate lost condition: ${token}`);
const gateCode = gate.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
for (const token of ["||", "?.", "toLowerCase", "trim(", "import ", "require(", "production", "console."])
  if (gateCode.includes(token)) throw new Error(`Claimant Preview gate contains a loosening or side effect: ${token}`);

const runtimeConfig = readFileSync(join(root, "services/api/src/claimant/runtime-config.ts"), "utf8");
for (const token of ['claimantPreviewCapabilityNames = ["authentication", "offlineCodeV2"] as const',
  'if (environment === "preview") limitToActivatedPreview(effective, isClaimantPreviewActivated(env));',
  "CLAIMANT_PRODUCTION_ACTIVATION_APPROVED = false as const",
  'if (environment === "production" && (masterEnabled || Object.values(requested).some(Boolean))) {'])
  if (!runtimeConfig.includes(token)) throw new Error(`Claimant runtime config lost Preview boundary: ${token}`);
const portal = readFileSync(join(root, "services/api/src/claimant/portal-session-routes.ts"), "utf8");
if (!portal.includes('if (isClaimantPreviewActivated()) return context.json({ error: "Not found" }, 404);'))
  throw new Error("Claimant portal session must stay concealed on the claimant Preview until W2.");

// W1 trusted edge: only Vercel's own client address header, only on Vercel, only into the controller.
const signals = readFileSync(join(root, "services/api/src/claimant/vercel-trusted-signals.ts"), "utf8");
const signalsCode = signals.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
for (const token of ['VERCEL_CLIENT_ADDRESS_HEADER = "x-vercel-forwarded-for"', 'if (env.VERCEL !== "1") return null;',
  "isIP(address) === 0"])
  if (!signalsCode.includes(token)) throw new Error(`Vercel trusted signal lost boundary: ${token}`);
for (const token of ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip", "console.", "deviceSignal"])
  if (signalsCode.toLowerCase().includes(token)) throw new Error(`Vercel trusted signal reads ${token}`);
if ([...signalsCode.matchAll(/env\.([A-Z_]+)/gu)].some((match) => match[1] !== "VERCEL"))
  throw new Error("Vercel trusted signal must read only VERCEL.");

for (const file of sourceFiles(join(root, "services")).concat(sourceFiles(join(root, "apps")))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (path === gatePath || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
  const source = readFileSync(file, "utf8");
  if ((source.includes("preview-activation") || source.includes("isClaimantPreviewActivated"))
    && !allowedImporters.has(path)) throw new Error(`Claimant Preview gate is used outside W1: ${path}`);
  if (source.includes("CLAIMANT_PREVIEW_ACTIVATION") && path !== gatePath)
    throw new Error(`Claimant Preview activation variable is read outside the gate: ${path}`);
}

console.log("Claimant Preview activation isolation check passed.");

function sourceFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", "dist", "coverage", ".next", ".expo", "android", "ios"].includes(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...sourceFiles(path));
    else if (/\.(ts|tsx|js|cjs|mjs)$/u.test(entry)) output.push(path);
  }
  return output;
}
