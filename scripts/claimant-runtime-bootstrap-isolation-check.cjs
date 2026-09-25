const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const paths = {
  bootstrap: "apps/mobile/src/features/claimant-journey/runtime-bootstrap.ts",
  layout: "apps/mobile/app/_layout.tsx",
};
const protectedSymbols = ["claimant-journey/runtime-bootstrap", "runtime-bootstrap",
  "createClaimantRuntimeBootstrap", "mountDisabledClaimantRuntimeBootstrap",
  "CLAIMANT_RUNTIME_BOOTSTRAP_APPROVED"];
const forbiddenIdentifiers = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios",
  "process", "globalThis", "window", "document", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console", "router", "navigation",
  "requireOptionalNativeModule"]);

function validateBootstrap(source) {
  if (!source?.includes("CLAIMANT_RUNTIME_BOOTSTRAP_APPROVED = false as const"))
    throw new Error("Claimant runtime bootstrap must remain literal false.");
  for (const token of ["input.enabled !== true", "input.killSwitchEngaged !== false",
    "runtimeInput?.syntheticOnly !== true", "runtimeInput.productionRuntime !== false",
    "createClaimantRuntimeFoundation", "runtime.cancel()", "runtime.dispose()", "closeRuntime(runtime)",
    "identity_verified: false", "release_authorized: false", "mountDisabledClaimantRuntimeBootstrap"])
    if (!source.includes(token)) throw new Error(`Missing claimant runtime bootstrap control: ${token}`);

  const ast = ts.createSourceFile(paths.bootstrap, source, ts.ScriptTarget.Latest, true);
  const allowedImports = new Set(["./runtime-foundation", "./runtime-launch-policy"]);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !allowedImports.has(node.moduleSpecifier.text)))
      throw new Error("Claimant runtime bootstrap imports an unapproved adapter.");
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text))
      throw new Error(`Claimant runtime bootstrap contains ambient access: ${node.text}`);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Claimant runtime bootstrap cannot load dynamic adapters.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function validateSources(sources) {
  const bootstrap = sources.get(paths.bootstrap);
  const layout = sources.get(paths.layout);
  if (!bootstrap || !layout) throw new Error("Claimant runtime bootstrap wiring is missing.");
  validateBootstrap(bootstrap);
  for (const token of [
    'import { mountDisabledClaimantRuntimeBootstrap } from "@/features/claimant-journey/runtime-bootstrap"',
    "mountDisabledClaimantRuntimeBootstrap()", 'AppState.addEventListener("change"',
    "claimantRuntime.handleAppState(nextAppState)", "void claimantRuntime.dispose()",
  ]) if (!layout.includes(token)) throw new Error(`Missing claimant application lifecycle control: ${token}`);

  for (const [path, source] of sources) {
    if (path === paths.bootstrap || path === paths.layout || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
    if (protectedSymbols.some((symbol) => source.includes(symbol)))
      throw new Error(`Claimant runtime bootstrap importer: ${path}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant runtime bootstrap isolation passed.");
}

module.exports = { paths, validateSources };
