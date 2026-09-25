const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { validateSources, path } = require("./claimant-whole-journey-acceptance-isolation-check.cjs");

const baseline = collectSources(join(__dirname, ".."));

test("whole-journey acceptance remains disabled and isolated", () => validateSources(baseline));

test("rejects activation and ambient adapters", () => {
  for (const mutate of [(source) => source.replace("APPROVED = false as const", "APPROVED = true as const"),
    (source) => `${source}\nfetch("https://example.test")`,
    (source) => `${source}\nimport auth from "@supabase/supabase-js"`,
    (source) => `${source}\nconst route = router`]) {
    const sources = new Map(baseline);
    sources.set(path, mutate(sources.get(path)));
    assert.throws(() => validateSources(sources));
  }
});

test("rejects a normal application importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claimant.tsx",
    'import { createClaimantWholeJourneyAcceptanceHarness } from "../src/features/claimant-journey/whole-journey-acceptance";');
  assert.throws(() => validateSources(sources), /runtime importer/u);
});
