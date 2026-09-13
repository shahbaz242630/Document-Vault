const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const path = "apps/mobile/src/features/claimant-handoff/possession-bridge.ts";
const imports = new Set(["@vault/shared-types", "zod", "../claimant-offline-code/offline-code-v2-lifecycle",
  "../claimant-offline-code/offline-code-v2-coordinator", "../claimant-offline-code/offline-code-v2-proof-core",
  "../claimant-offline-code/offline-code-v2-transport", "./contracts", "./lifecycle", "./transport"]);
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "console"]);
function validateSources(sources) {
  const source = sources.get(path);
  if (!source?.includes("export const CLAIMANT_POSSESSION_HANDOFF_BRIDGE_APPROVED = false as const;"))
    throw new Error("Possession handoff bridge must remain literal false.");
  for (const token of ["possession.startVerified", "possession.retryProofVerified", "createHandoffLifecycle",
    "validateSession", "session.userId !== binding.userId", "generation !== currentGeneration",
    "event.sequence <= lastEvent.sequence", "possession?.cancel()", "handoff?.cancel()"])
    if (!source.includes(token)) throw new Error(`Missing bridge control: ${token}`);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error("Unapproved bridge adapter.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient bridge runtime access.");
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Dynamic bridge adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [other, content] of sources) {
    if (other === path || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (["possession-bridge", "createPossessionHandoffBridge", "CLAIMANT_POSSESSION_HANDOFF_BRIDGE_APPROVED"]
      .some((symbol) => content.includes(symbol))) throw new Error(`Bridge runtime importer: ${other}`);
  }
}
if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant possession handoff bridge isolation passed.");
}
module.exports = { validateSources, path };
