const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { validateSources, path } = require("./claimant-possession-handoff-bridge-isolation-check.cjs");
const baseline = collectSources(join(__dirname, ".."));
test("bridge remains disabled and isolated", () => validateSources(baseline));
test("rejects activation and ambient adapters", () => {
  for (const mutate of [(s) => s.replace("APPROVED = false as const", "APPROVED = true as const"),
    (s) => s + '\nfetch("https://example.test")',
    (s) => s + '\nimport native from "expo-secure-store"']) {
    const sources = new Map(baseline); sources.set(path, mutate(sources.get(path)));
    assert.throws(() => validateSources(sources));
  }
});
test("rejects normal app importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claim.tsx", 'import { createPossessionHandoffBridge } from "../src/features/claimant-handoff/possession-bridge";');
  assert.throws(() => validateSources(sources), /runtime importer/);
});
