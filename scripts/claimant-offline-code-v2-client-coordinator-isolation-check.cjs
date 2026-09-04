const { readFileSync, readdirSync } = require("node:fs");
const { join, relative } = require("node:path");
const ts = require("typescript");
const { lifecyclePath, validateLifecycleSources } = require("./claimant-offline-code-v2-lifecycle-isolation-check.cjs");

const feature = "apps/mobile/src/features/claimant-offline-code/";
const transportPath = `${feature}offline-code-v2-transport.ts`;
const coordinatorPath = `${feature}offline-code-v2-coordinator.ts`;
const protectedSymbols = ["offline-code-v2-transport", "offline-code-v2-coordinator",
  "createOfflineCodeV2Transport", "createOfflineCodeV2Coordinator",
  "CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED", "CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED"];

function validateSources(sources) {
  // Exactly one separately guarded composition root may consume the 5I modules.
  validateLifecycleSources(sources);
  const transport = sources.get(transportPath);
  const coordinator = sources.get(coordinatorPath);
  if (!transport || !coordinator) throw new Error("Offline-code V2 client boundary is missing.");
  for (const [source, flag] of [[transport, "CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED"],
    [coordinator, "CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED"]]) {
    if (!new RegExp(`export const ${flag} = false as const;`, "u").test(source))
      throw new Error("Offline-code V2 client approvals must remain literal false.");
  }
  for (const token of ["syntheticOnly !== true", "material = null", "MAX_PROOF_SENDS = 3",
    "validateOfflineCodeV2IssuedChallenge", "validateOfflineCodeV2ProofRequest",
    "validateOfflineCodeV2PossessionResult", "controller.signal.aborted"])
    if (!coordinator.includes(token)) throw new Error(`Offline-code V2 coordinator lost ${token}.`);
  for (const token of ['credentials: "omit"', 'redirect: "error"', 'cache: "no-store"',
    "const send = input.send;", "MAX_RESPONSE_BYTES = 16_384", "REQUEST_TIMEOUT_MS = 15_000"])
    if (!transport.includes(token)) throw new Error(`Offline-code V2 transport lost ${token}.`);

  const permittedImports = new Set(["@vault/shared-types", "buffer", "zod",
    "./offline-code-v2-proof-core", "./offline-code-v2-transport", "./offline-code-v2-coordinator"]);
  const forbiddenIdentifiers = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios",
    "process", "globalThis", "localStorage", "sessionStorage", "indexedDB", "SecureStore", "AsyncStorage", "console"]);
  for (const [path, source] of sources) {
    if (/\.test\.[cm]?[jt]sx?$/u.test(path)) continue;
    if (path !== transportPath && path !== coordinatorPath && path !== lifecyclePath) {
      if (protectedSymbols.some((symbol) => source.includes(symbol)))
        throw new Error(`Offline-code V2 client is imported outside its isolated boundary: ${path}`);
      continue;
    }
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
        || !permittedImports.has(node.moduleSpecifier.text)))
        throw new Error(`Offline-code V2 client imports an unapproved adapter: ${path}`);
      // typeof fetch is a type contract only; a runtime fetch reference is forbidden.
      if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)
        && !(node.text === "fetch" && ts.isTypeQueryNode(node.parent)))
        throw new Error(`Offline-code V2 client contains forbidden runtime access: ${node.text}`);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
        throw new Error("Offline-code V2 client cannot load dynamic adapters.");
      ts.forEachChild(node, visit);
    }
    visit(ast);
    for (const token of ["Authorization", "Cookie", "production_approved: true", "storage.from"])
      if (source.includes(token)) throw new Error(`Offline-code V2 client contains forbidden authority: ${token}`);
  }
}

function collectSources(root) {
  const sources = new Map();
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", ".expo", ".next", ".vercel", "dist", "coverage"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.[cm]?[jt]sx?$/u.test(entry.name))
        sources.set(relative(root, path).replaceAll("\\", "/"), readFileSync(path, "utf8"));
    }
  }
  for (const directory of ["apps/mobile", "apps/web", "services/api/src", "packages/shared-types/src"])
    walk(join(root, directory));
  return sources;
}

if (require.main === module) validateSources(collectSources(join(__dirname, "..")));
module.exports = { validateSources, collectSources, transportPath, coordinatorPath };
