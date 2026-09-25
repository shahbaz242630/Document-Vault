const { join } = require("node:path");
const ts = require("typescript");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const paths = {
  identity: "apps/mobile/src/features/claimant-session/hosted-identity-boundary.ts",
  signing: "apps/mobile/src/features/claimant-handoff/native-signing-boundary.ts",
  runtime: "apps/mobile/src/features/claimant-journey/runtime-foundation.ts",
};
const bootstrapPath = "apps/mobile/src/features/claimant-journey/runtime-bootstrap.ts";
const imports = {
  identity: new Set(["zod"]), signing: new Set(["zod"]),
  runtime: new Set(["../claimant-handoff/native-signing-boundary",
    "../claimant-session/hosted-identity-boundary", "./session-journey-composition"]),
};
const forbidden = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "axios", "process",
  "globalThis", "window", "document", "AppState", "localStorage", "sessionStorage", "indexedDB",
  "SecureStore", "AsyncStorage", "supabase", "console", "router", "navigation", "requireOptionalNativeModule"]);

function validateFile(source, path, allowedImports) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !allowedImports.has(node.moduleSpecifier.text))) throw new Error(`Unapproved runtime-foundation adapter: ${path}`);
    if (ts.isIdentifier(node) && forbidden.has(node.text)) throw new Error(`Ambient runtime-foundation access: ${path}`);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
      throw new Error(`Dynamic runtime-foundation adapter: ${path}`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function validateSources(sources) {
  const identity = sources.get(paths.identity); const signing = sources.get(paths.signing);
  const runtime = sources.get(paths.runtime);
  if (!identity?.includes("CLAIMANT_HOSTED_IDENTITY_BOUNDARY_APPROVED = false as const"))
    throw new Error("Hosted identity boundary must remain literal false.");
  if (!signing?.includes("CLAIMANT_NATIVE_SIGNING_BOUNDARY_APPROVED = false as const"))
    throw new Error("Native signing boundary must remain literal false.");
  if (!runtime?.includes("CLAIMANT_RUNTIME_FOUNDATION_APPROVED = false as const"))
    throw new Error("Claimant runtime foundation must remain literal false.");
  for (const token of ["syntheticOnly: z.literal(true)", "aal: z.literal(\"aal2\")",
    "recovery: z.literal(false)", "audience: z.literal(\"authenticated\")", "sameSession", "unavailable: true"])
    if (!identity.includes(token)) throw new Error(`Missing hosted identity control: ${token}`);
  for (const token of ["claimant-handoff\\.test\\.v1", "user_presence: z.literal(\"verified\")",
    "private_key_exportable: z.literal(false)", "key_alias_reference", "key_fingerprint", "pending.catch"])
    if (!signing.includes(token)) throw new Error(`Missing native signing control: ${token}`);
  for (const token of ["createClaimantHostedIdentityBoundary", "createClaimantNativeSigningBoundary",
    "createClaimantSessionJourneyComposition", "identity_verified: false", "relationship_verified: false",
    "release_authorized: false", "Promise.all"])
    if (!runtime.includes(token)) throw new Error(`Missing runtime foundation control: ${token}`);
  validateFile(identity, paths.identity, imports.identity); validateFile(signing, paths.signing, imports.signing);
  validateFile(runtime, paths.runtime, imports.runtime);
  for (const [other, content] of sources) {
    if (Object.values(paths).includes(other) || /\.test\.[cm]?[jt]sx?$/u.test(other)) continue;
    if (other === bootstrapPath) {
      if (!content.includes('from "./runtime-foundation"'))
        throw new Error(`Claimant runtime-foundation importer: ${other}`);
      continue;
    }
    if (["hosted-identity-boundary", "native-signing-boundary", "runtime-foundation",
      "createClaimantRuntimeFoundation", "CLAIMANT_RUNTIME_FOUNDATION_APPROVED"].some((value) => content.includes(value)))
      throw new Error(`Claimant runtime-foundation importer: ${other}`);
  }
}

if (require.main === module) {
  validateSources(collectSources(join(__dirname, "..")));
  console.log("Claimant runtime foundations isolation passed.");
}

module.exports = { paths, validateSources };
