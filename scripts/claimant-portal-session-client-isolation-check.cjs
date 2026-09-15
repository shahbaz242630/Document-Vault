const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const path = "apps/mobile/src/features/claimant-session/portal-session-client.ts";
const imports = new Set(["zod"]);
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console"]);

function validateSources(sources) {
  const source = sources.get(path);
  if (!source?.includes("export const CLAIMANT_PORTAL_SESSION_CLIENT_APPROVED = false as const;"))
    throw new Error("Claimant portal session client must remain literal false.");
  for (const token of ["/claimant/portal/session/", "Authorization", "Idempotency-Key", "body: EMPTY_BODY",
    "sessionVersion", "pendingRetry", "generation !== currentGeneration", "listeners", "await this.activeCompletion"])
    if (!source.includes(token)) throw new Error(`Missing claimant session client control: ${token}`);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error("Unapproved claimant session adapter.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient claimant session runtime access.");
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Dynamic claimant session adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [other, content] of sources) {
    if (other === path || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (["claimant-session/portal-session-client", "createSyntheticClaimantPortalSessionClient",
      "CLAIMANT_PORTAL_SESSION_CLIENT_APPROVED"].some((symbol) => content.includes(symbol)))
      throw new Error(`Claimant session client runtime importer: ${other}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant portal session client isolation passed.");
}

module.exports = { validateSources, path };
