const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { validateSources, files } = require("./claimant-handoff-client-isolation-check.cjs");
const baseline = collectSources(join(__dirname, ".."));
test("handoff client stays isolated and disabled", () => validateSources(baseline));
test("rejects capability activation, network, storage and native adapters", () => {
  for (const mutation of [
    (s) => s.replace("APPROVED = false as const", "APPROVED = true as const"),
    (s) => s + '\nfetch("https://example.test");',
    (s) => s + '\nlocalStorage.setItem("key", "value");',
    (s) => s + '\nimport native from "react-native-libsodium";',
    (s) => s + '\nimport("native-adapter");',
  ]) {
    const sources = new Map(baseline); sources.set(files[1], mutation(sources.get(files[1])));
    assert.throws(() => validateSources(sources));
  }
});
test("rejects a normal app importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claim.tsx", 'import { createHandoffCoordinator } from "../src/features/claimant-handoff/coordinator";');
  assert.throws(() => validateSources(sources), /runtime importer/);
});
