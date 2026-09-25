const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const paths = {
  policy: "apps/mobile/src/features/claimant-journey/runtime-launch-policy.ts",
  bootstrap: "apps/mobile/src/features/claimant-journey/runtime-bootstrap.ts",
};
const protectedSymbols = ["runtime-launch-policy", "readClaimantRuntimeLaunchPolicy",
  "CLAIMANT_RUNTIME_LAUNCH_APPROVED", "CLAIMANT_RUNTIME_FEATURE_ENABLED",
  "CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED"];
const forbiddenIdentifiers = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios",
  "process", "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage",
  "indexedDB", "SecureStore", "AsyncStorage", "supabase", "console", "router", "navigation",
  "requireOptionalNativeModule"]);

function validatePolicy(source) {
  for (const token of [
    "CLAIMANT_RUNTIME_LAUNCH_APPROVED = false as const",
    "CLAIMANT_RUNTIME_FEATURE_ENABLED = false as const",
    "CLAIMANT_RUNTIME_KILL_SWITCH_ENGAGED = true as const",
    'source: "bundled_default" as const', "synthetic_only: true as const",
    "production_runtime: false as const", "identity_verified: false as const",
    "release_authorized: false as const", "Object.freeze",
  ]) if (!source?.includes(token)) throw new Error(`Missing claimant launch-policy control: ${token}`);

  const ast = ts.createSourceFile(paths.policy, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node)) throw new Error("Claimant launch policy cannot import adapters.");
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text))
      throw new Error(`Claimant launch policy contains ambient access: ${node.text}`);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Claimant launch policy cannot load dynamic adapters.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function validateSources(sources) {
  const policy = sources.get(paths.policy);
  const bootstrap = sources.get(paths.bootstrap);
  if (!policy || !bootstrap) throw new Error("Claimant runtime launch policy is missing.");
  validatePolicy(policy);
  for (const token of ['from "./runtime-launch-policy"', "readClaimantRuntimeLaunchPolicy()",
    "approved: launchPolicy.approved", "enabled: launchPolicy.enabled",
    "killSwitchEngaged: launchPolicy.killSwitchEngaged"])
    if (!bootstrap.includes(token)) throw new Error(`Missing claimant launch-policy wiring: ${token}`);

  for (const [path, source] of sources) {
    if (path === paths.policy || path === paths.bootstrap || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
    if (protectedSymbols.some((symbol) => source.includes(symbol)))
      throw new Error(`Claimant runtime launch-policy importer: ${path}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant runtime launch policy isolation passed.");
}

module.exports = { paths, validateSources };
