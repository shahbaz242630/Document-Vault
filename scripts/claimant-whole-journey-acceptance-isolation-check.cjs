const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const path = "apps/mobile/src/features/claimant-journey/whole-journey-acceptance.ts";
const imports = new Set(["zod", "@vault/shared-types", "./session-journey-composition"]);
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console", "router", "navigation"]);

function validateSources(sources) {
  const source = sources.get(path);
  if (!source?.includes("export const CLAIMANT_WHOLE_JOURNEY_ACCEPTANCE_APPROVED = false as const;"))
    throw new Error("Claimant whole-journey acceptance must remain literal false.");
  for (const token of ["createClaimantSessionJourneyComposition", "applySyntheticSubmissionHandoff",
    "applySyntheticClaimScenarioStep", "reconcileSyntheticClaimAuditLedger", "safeDraftSchema",
    "identity_verified: false", "relationship_verified: false", "release_authorized: false",
    "decryption_authorized: false", "runtime_effect: false"])
    if (!source.includes(token)) throw new Error(`Missing whole-journey acceptance control: ${token}`);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error("Unapproved whole-journey adapter.");
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient whole-journey access.");
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error("Dynamic whole-journey adapter.");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const [other, content] of sources) {
    if (other === path || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (["claimant-journey/whole-journey-acceptance", "createClaimantWholeJourneyAcceptanceHarness",
      "CLAIMANT_WHOLE_JOURNEY_ACCEPTANCE_APPROVED"].some((symbol) => content.includes(symbol)))
      throw new Error(`Whole-journey acceptance runtime importer: ${other}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant whole-journey acceptance isolation passed.");
}

module.exports = { validateSources, path };
