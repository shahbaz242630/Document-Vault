const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const directory = "apps/mobile/src/features/claimant-handoff/";
const files = ["contracts.ts", "transport.ts", "coordinator.ts"].map((name) => directory + name);
const symbols = ["claimant-handoff/", "createHandoffTransport", "createHandoffCoordinator",
  "CLAIMANT_HANDOFF_TRANSPORT_APPROVED", "CLAIMANT_HANDOFF_COORDINATOR_APPROVED"];
function validateSources(sources) {
  for (const path of files) if (!sources.has(path)) throw new Error(`Missing handoff client: ${path}`);
  for (const [file, flag] of [["transport.ts", "TRANSPORT"], ["coordinator.ts", "COORDINATOR"]]) {
    if (!sources.get(directory + file).includes(`export const CLAIMANT_HANDOFF_${flag}_APPROVED = false as const;`))
      throw new Error("Handoff client approval must remain literal false.");
  }
  const allowedImports = new Set(["buffer", "zod", "./contracts", "./transport"]);
  const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
    "globalThis", "localStorage", "sessionStorage", "indexedDB", "SecureStore", "AsyncStorage", "console"]);
  for (const [path, source] of sources) {
    if (/\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
    if (!files.includes(path)) {
      if (symbols.some((symbol) => source.includes(symbol))) throw new Error(`Handoff client runtime importer: ${path}`);
      continue;
    }
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
        || !allowedImports.has(node.moduleSpecifier.text))) throw new Error("Unapproved handoff adapter.");
      if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error("Ambient handoff runtime access.");
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) throw new Error("Dynamic handoff adapter.");
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const coordinator = sources.get(directory + "coordinator.ts");
  for (const token of ["syntheticOnly !== true", "MAX_COMPLETION_SENDS = 3", "validateTranscript", "validateSession",
    "checkpoint(controller, request.binding)", "pending = null", "active?.abort()"])
    if (!coordinator.includes(token)) throw new Error(`Missing handoff lifecycle control: ${token}`);
  const transport = sources.get(directory + "transport.ts");
  for (const token of ['credentials: "omit"', 'redirect: "error"', 'cache: "no-store"',
    "MAX_RESPONSE_BYTES = 16_384", "REQUEST_TIMEOUT_MS = 15_000"])
    if (!transport.includes(token)) throw new Error(`Missing handoff transport control: ${token}`);
}
if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant authenticated handoff client isolation passed.");
}
module.exports = { validateSources, files };
