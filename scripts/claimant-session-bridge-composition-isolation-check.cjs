const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const path = "apps/mobile/src/features/claimant-handoff/session-bridge-composition.ts";
const imports = new Set(["zod", "./contracts", "./possession-bridge"]);
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console"]);

function validateSources(sources) {
  const source = sources.get(path);
  if (!source?.includes("export const CLAIMANT_SESSION_BRIDGE_COMPOSITION_APPROVED = false as const;"))
    throw new Error("Session bridge composition must remain literal false.");
  for (const token of ["validateSession", "createPossessionHandoffBridge", "sessionVersion",
    "event.sequence <= this.lastEvent.sequence", "this.bridge?.cancel()", "await this.bridgeDisposal",
    "case_created: true", "identity_verified: false", "release_authorized: false"])
    if (!source.includes(token)) throw new Error(`Missing session bridge control: ${token}`);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error("Unapproved session bridge adapter.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient session bridge runtime access.");
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Dynamic session bridge adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [other, content] of sources) {
    if (other === path || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (["session-bridge-composition", "createClaimantSessionBridgeComposition",
      "CLAIMANT_SESSION_BRIDGE_COMPOSITION_APPROVED"].some((symbol) => content.includes(symbol)))
      throw new Error(`Session bridge runtime importer: ${other}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant session bridge composition isolation passed.");
}

module.exports = { validateSources, path };
