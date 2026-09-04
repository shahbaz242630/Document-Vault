const { join } = require("node:path");
const ts = require("typescript");

const lifecyclePath = "apps/mobile/src/features/claimant-offline-code/offline-code-v2-lifecycle.ts";
function validateLifecycleSources(sources) {
  const source = sources.get(lifecyclePath);
  if (!source || !source.includes("export const CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED = false as const;"))
    throw new Error("Offline-code V2 lifecycle approval must remain literal false.");
  for (const token of ["input.syntheticOnly !== true", "input.productionRuntime !== false", "coordinator?.cancel()",
    "generation !== startedGeneration", "closed || !initialized || !foreground || active || !coordinator",
    "event.sequence <= lastEvent.sequence", "if (!lastEvent || closed)", "unsubscribe = null",
    'event.state === "locked"', 'event.state === "session_ended"', 'event.state === "disabled"',
    "createOfflineCodeV2Coordinator", "createOfflineCodeV2Transport", "return activeCompletion ?? Promise.resolve()"])
    if (!source.includes(token)) throw new Error(`Offline-code V2 lifecycle lost safety boundary: ${token}`);
  const imports = new Set(["@vault/shared-types", "zod", "./offline-code-v2-coordinator",
    "./offline-code-v2-proof-core", "./offline-code-v2-transport"]);
  const forbidden = new Set(["fetch", "process", "globalThis", "window", "document", "AppState", "console",
    "localStorage", "sessionStorage", "indexedDB", "SecureStore", "AsyncStorage", "WebSocket", "XMLHttpRequest"]);
  const ast = ts.createSourceFile(lifecyclePath, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier) || !imports.has(node.moduleSpecifier.text)))
      throw new Error("Offline-code V2 lifecycle contains a direct provider/native/runtime import.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)
      && !(node.text === "fetch" && ts.isTypeQueryNode(node.parent)))
      throw new Error(`Offline-code V2 lifecycle contains forbidden runtime access: ${node.text}`);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Offline-code V2 lifecycle contains a dynamic adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [path, content] of sources) {
    if (path === lifecyclePath || /\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
    if (["offline-code-v2-lifecycle", "createOfflineCodeV2Lifecycle", "CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED"]
      .some((symbol) => content.includes(symbol)))
      throw new Error(`Offline-code V2 lifecycle is imported by normal runtime: ${path}`);
  }
}

module.exports = { lifecyclePath, validateLifecycleSources };
if (require.main === module) {
  const { collectSources, validateSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
  validateSources(collectSources(join(__dirname, "..")));
}
