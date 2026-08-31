const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources, validateSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { lifecyclePath } = require("./claimant-offline-code-v2-lifecycle-isolation-check.cjs");

const sources = collectSources(join(__dirname, ".."));
test("5J is the sole disabled composition exception and is disconnected from application runtime", () => {
  validateSources(sources);
});
test("5J exception fails closed when removed, enabled, or stripped of lifecycle/synthetic checks", () => {
  const missing = new Map(sources); missing.delete(lifecyclePath);
  assert.throws(() => validateSources(missing));
  for (const [original, replacement] of [
    ["= false as const", "= true as const"],
    ["input.syntheticOnly !== true", "false"],
    ["input.productionRuntime !== false", "false"],
    ["generation !== startedGeneration", "false"],
    ["coordinator?.cancel()", "undefined"],
    ["event.sequence <= lastEvent.sequence", "false"],
    ["if (!lastEvent || closed)", "if (closed)"],
  ]) {
    const changed = new Map(sources); changed.set(lifecyclePath, sources.get(lifecyclePath).replaceAll(original, replacement));
    assert.throws(() => validateSources(changed));
  }
});
test("5J rejects native/provider/storage access and all normal, probe, and barrel imports", () => {
  for (const addition of ["fetch('https://example.test')", "console.log('data')", "AppState.currentState",
    "import('./adapter')", "localStorage.setItem('proof','data')", "import x from 'react-native'",
    "import x from './offline-code-v2-proof-producer.native'"]) {
    const changed = new Map(sources); changed.set(lifecyclePath, `${sources.get(lifecyclePath)}\n${addition}`);
    assert.throws(() => validateSources(changed));
  }
  for (const path of ["apps/mobile/app/index.tsx", "apps/mobile/offline-code-kdf-probe-app/index.tsx",
    "apps/mobile/src/features/claimant-offline-code/bridge.ts", "apps/web/app/page.tsx",
    "services/api/src/bridge.ts", "packages/shared-types/src/index.ts"]) {
    const changed = new Map(sources); changed.set(path, 'export { createOfflineCodeV2Lifecycle as runtime } from "./offline-code-v2-lifecycle";');
    assert.throws(() => validateSources(changed));
  }
});
