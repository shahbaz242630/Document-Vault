const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { paths, validateSources } = require("./claimant-runtime-launch-policy-isolation-check.cjs");

const baseline = collectSources(join(__dirname, ".."));

test("Slice 6B launch policy remains bundled, disabled, and kill-switched", () => validateSources(baseline));

test("rejects launch control changes and ambient adapters", () => {
  for (const mutate of [
    (source) => source.replace("LAUNCH_APPROVED = false", "LAUNCH_APPROVED = true"),
    (source) => source.replace("FEATURE_ENABLED = false", "FEATURE_ENABLED = true"),
    (source) => source.replace("KILL_SWITCH_ENGAGED = true", "KILL_SWITCH_ENGAGED = false"),
    (source) => `${source}\nconst env = process.env`,
    (source) => `${source}\nfetch("https://example.test")`,
    (source) => `import value from "./provider";\n${source}`,
  ]) {
    const sources = new Map(baseline);
    sources.set(paths.policy, mutate(sources.get(paths.policy)));
    assert.throws(() => validateSources(sources));
  }
});

test("rejects a second launch-policy importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claimant.tsx",
    'import { readClaimantRuntimeLaunchPolicy } from "../src/features/claimant-journey/runtime-launch-policy";');
  assert.throws(() => validateSources(sources), /launch-policy importer/u);
});

test("rejects incomplete bootstrap policy wiring", () => {
  for (const token of ["approved: launchPolicy.approved", "enabled: launchPolicy.enabled",
    "killSwitchEngaged: launchPolicy.killSwitchEngaged"]) {
    const sources = new Map(baseline);
    sources.set(paths.bootstrap, sources.get(paths.bootstrap).replace(token, ""));
    assert.throws(() => validateSources(sources), /launch-policy wiring/u);
  }
});
