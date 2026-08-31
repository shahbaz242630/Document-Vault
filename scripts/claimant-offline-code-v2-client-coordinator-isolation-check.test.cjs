const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { validateSources, collectSources, transportPath, coordinatorPath } =
  require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");

const sources = collectSources(join(__dirname, ".."));
test("Slice 5I stays hard-disabled, adapter-injected, and outside every runtime", () => {
  validateSources(sources);
});
test("Slice 5I guard rejects enabling, direct network/storage, and native imports", () => {
  for (const [path, mutate] of [
    [transportPath, (s) => s.replace("= false as const", "= true as const")],
    [coordinatorPath, (s) => s.replace("= false as const", "= true as const")],
    [transportPath, (s) => s.replace("const send = input.send;", "const send = input.send ?? fetch;")],
    [coordinatorPath, (s) => `${s}\nfetch('https://example.test');`],
    [coordinatorPath, (s) => `${s}\nlocalStorage.setItem('proof', 'data');`],
    [coordinatorPath, (s) => `${s}\nimport native from './offline-code-v2-proof-producer.native';`],
    [coordinatorPath, (s) => `${s}\nimport('./adapter');`],
    [coordinatorPath, (s) => s.replace("syntheticOnly !== true", "syntheticOnly === false")],
  ]) {
    const changed = new Map(sources); changed.set(path, mutate(changed.get(path)));
    assert.throws(() => validateSources(changed));
  }
});
test("Slice 5I guard rejects runtime, probe, sibling, barrel, and API import paths", () => {
  for (const path of ["apps/mobile/app/index.tsx", "apps/mobile/offline-code-kdf-probe-app/index.tsx",
    "apps/mobile/src/features/claimant-offline-code/bridge.ts", "packages/shared-types/src/index.ts",
    "apps/web/app/page.tsx", "services/api/src/bridge.ts"]) {
    const changed = new Map(sources);
    changed.set(path, 'export { createOfflineCodeV2Coordinator as coordinator } from "./offline-code-v2-coordinator";');
    assert.throws(() => validateSources(changed));
  }
});
