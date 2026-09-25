const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { paths, validateSources } = require("./claimant-runtime-bootstrap-isolation-check.cjs");

const baseline = collectSources(join(__dirname, ".."));

test("Slice 6A bootstrap remains disabled, fail-closed, and singly mounted", () => validateSources(baseline));

test("rejects activation and ambient or dynamic adapters", () => {
  for (const mutate of [
    (source) => source.replace("APPROVED = false", "APPROVED = true"),
    (source) => `${source}\nfetch("https://example.test")`,
    (source) => `${source}\nconst env = process.env`,
    (source) => `${source}\nvoid import("./provider")`,
  ]) {
    const sources = new Map(baseline);
    sources.set(paths.bootstrap, mutate(sources.get(paths.bootstrap)));
    assert.throws(() => validateSources(sources));
  }
});

test("rejects a second application importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claimant.tsx",
    'import { createClaimantRuntimeBootstrap } from "../src/features/claimant-journey/runtime-bootstrap";');
  assert.throws(() => validateSources(sources), /runtime bootstrap importer/u);
});

test("rejects removal of application lifecycle closure", () => {
  for (const token of ["claimantRuntime.handleAppState(nextAppState)", "void claimantRuntime.dispose()"]) {
    const sources = new Map(baseline);
    sources.set(paths.layout, sources.get(paths.layout).replace(token, "void claimantRuntime.snapshot()"));
    assert.throws(() => validateSources(sources), /lifecycle control/u);
  }
});
