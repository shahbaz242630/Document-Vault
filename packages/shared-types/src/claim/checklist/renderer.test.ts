import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  ClaimantChecklistItemKey,
  SyntheticChecklistItemAvailability,
} from "./contracts";
import {
  createSyntheticChecklistRoutingFacts,
  syntheticChecklistPolicyPack,
} from "./fixtures";
import { renderSyntheticClaimantChecklist } from "./renderer";

const validTime = "2026-08-01T10:00:00.000Z";

function render(
  conditions = {},
  availability: Partial<
    Record<ClaimantChecklistItemKey, SyntheticChecklistItemAvailability>
  > = {},
) {
  return renderSyntheticClaimantChecklist({
    packs: [syntheticChecklistPolicyPack],
    facts: createSyntheticChecklistRoutingFacts(conditions),
    server_time: validTime,
    availability,
  });
}

describe("synthetic claimant checklist renderer", () => {
  it("renders the common catalogue with explanations and no release authority", () => {
    const checklist = render();

    expect(checklist.status).toBe("documents_needed");
    expect(checklist.items).toHaveLength(7);
    expect(checklist.items.every(({ source }) => source === "common")).toBe(true);
    expect(checklist.items.every(({ explanation }) => explanation.length > 20)).toBe(true);
    expect(checklist.release_authorized).toBe(false);
  });

  it("adds only conditional modules selected by routing facts", () => {
    const checklist = render({
      probate_required: true,
      translation_required: true,
    });

    expect(checklist.items.filter(({ source }) => source === "conditional").map(({ key }) => key)).toEqual([
      "probate_authority",
      "certified_translation",
    ]);
    expect(new Set(checklist.items.map(({ key }) => key)).size).toBe(
      checklist.items.length,
    );
  });

  it("routes an unavailable item to manual review, never rejection or release", () => {
    const checklist = render({}, { official_death_record: "not_available" });

    expect(checklist).toMatchObject({
      status: "manual_review",
      manual_review_reason: "document_unavailable",
      release_authorized: false,
    });
  });

  it("marks a complete checklist ready for review only", () => {
    const initial = render({ probate_required: true });
    const availability = Object.fromEntries(
      initial.items.map(({ key }) => [key, "available"]),
    ) as Partial<Record<ClaimantChecklistItemKey, "available">>;
    const complete = render({ probate_required: true }, availability);

    expect(complete.status).toBe("ready_for_review");
    expect(complete.release_authorized).toBe(false);
  });

  it("routes missing policy selection to manual review with no checklist", () => {
    const checklist = renderSyntheticClaimantChecklist({
      packs: [],
      facts: createSyntheticChecklistRoutingFacts(),
      server_time: validTime,
    });

    expect(checklist).toMatchObject({
      status: "manual_review",
      manual_review_reason: "missing_policy",
      policy_id: null,
      release_authorized: false,
      items: [],
    });
  });

  it("remains modular and runtime-disconnected", () => {
    const modules = [
      "./catalogue.ts",
      "./contracts.ts",
      "./fixtures.ts",
      "./policy-selection.ts",
      "./renderer.ts",
      "./synthetic-integrity.ts",
    ].map((path) =>
      readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"),
    );

    expect(modules.every((source) => source.split("\n").length < 220)).toBe(true);
    for (const source of modules) {
      for (const forbidden of [
        "@supabase/",
        "fetch(",
        "process.env",
        "localStorage",
        "sessionStorage",
        "document.cookie",
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });
});
