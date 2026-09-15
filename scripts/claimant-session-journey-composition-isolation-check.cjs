const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const path = "apps/mobile/src/features/claimant-journey/session-journey-composition.ts";
const approvedWrapper = "apps/mobile/src/features/claimant-journey/whole-journey-acceptance.ts";
const imports = new Set(["zod", "../claimant-handoff/session-bridge-composition",
  "../claimant-session/portal-session-client"]);
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console", "router", "navigation"]);

function validateSources(sources) {
  const source = sources.get(path);
  if (!source?.includes("export const CLAIMANT_SESSION_JOURNEY_COMPOSITION_APPROVED = false as const;"))
    throw new Error("Claimant session journey composition must remain literal false.");
  for (const token of ["createSyntheticClaimantPortalSessionClient", "createClaimantSessionBridgeComposition",
    "this.portal!.assert", "sameAuthenticated", "event.sequence <= this.lastEvent.sequence",
    "this.clearTransient()", "await this.activeCompletion", "identity_verified: false",
    "relationship_verified: false", "intake_started: false", "review_started: false",
    "release_authorized: false"])
    if (!source.includes(token)) throw new Error(`Missing claimant session journey control: ${token}`);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error("Unapproved claimant journey adapter.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient claimant journey access.");
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Dynamic claimant journey adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [other, content] of sources) {
    if (other === path || other === approvedWrapper || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (["claimant-journey/session-journey-composition", "createClaimantSessionJourneyComposition",
      "CLAIMANT_SESSION_JOURNEY_COMPOSITION_APPROVED"].some((symbol) => content.includes(symbol)))
      throw new Error(`Claimant session journey runtime importer: ${other}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant session journey composition isolation passed.");
}

module.exports = { validateSources, path };
