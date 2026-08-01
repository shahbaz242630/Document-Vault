import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  appendSyntheticClaimAuditEvent,
  reconcileSyntheticClaimAuditLedger,
  syntheticClaimAuditEventTypes,
  type SyntheticClaimAuditEventInputV1,
  type SyntheticClaimAuditEventV1,
} from "./audit";

function input(
  overrides: Partial<SyntheticClaimAuditEventInputV1> = {},
): SyntheticClaimAuditEventInputV1 {
  return {
    protocol: "sanduqkin:claim:audit-event:v1",
    synthetic_only: true,
    server_authored: true,
    tenant_id: "synthetic_tenant_alpha",
    case_id: "synthetic_case_alpha",
    event_id: "synthetic_event_001",
    event_type: "route_selected",
    actor_class: "claimant",
    actor_ref: "synthetic_actor_claimant_001",
    server_time: "2026-08-01T09:00:00.000Z",
    request_id: "synthetic_request_001",
    correlation_id: "synthetic_correlation_001",
    idempotency_key: "synthetic_idempotency_001",
    source_state: null,
    target_state: "draft",
    reason_class: "not_applicable",
    policy_version: "synthetic_policy_v1",
    schema_version: "synthetic_schema_v1",
    build_version: "synthetic_build_v1",
    object_ref: null,
    event_hash: "synthetic_hash_001",
    ...overrides,
  };
}

describe("synthetic claimant audit catalogue", () => {
  it("keeps delivery, open, export, and claimant confirmation distinct", () => {
    expect(syntheticClaimAuditEventTypes).toEqual(
      expect.arrayContaining([
        "encrypted_package_served",
        "local_open_reported",
        "export_confirmed",
        "claimant_confirmation_recorded",
      ]),
    );
    expect(new Set(syntheticClaimAuditEventTypes).size).toBe(
      syntheticClaimAuditEventTypes.length,
    );
  });
});

describe("synthetic claimant audit ledger", () => {
  it("appends immutable sequence and integrity linkage fields", () => {
    const first = appendSyntheticClaimAuditEvent([], input());
    expect(first.status).toBe("appended");

    const second = appendSyntheticClaimAuditEvent(
      first.ledger,
      input({
        event_hash: "synthetic_hash_002",
        event_id: "synthetic_event_002",
        event_type: "route_verified",
        idempotency_key: "synthetic_idempotency_002",
        request_id: "synthetic_request_002",
        server_time: "2026-08-01T09:01:00.000Z",
        source_state: "draft",
        target_state: "identity_pending",
      }),
    );

    expect(second.event).toMatchObject({
      previous_event_hash: "synthetic_hash_001",
      sequence: 2,
    });
    expect(reconcileSyntheticClaimAuditLedger(second.ledger)).toEqual([]);
  });

  it("returns the original event for an exact idempotent retry", () => {
    const first = appendSyntheticClaimAuditEvent([], input());
    const retry = appendSyntheticClaimAuditEvent(first.ledger, input());

    expect(retry.status).toBe("duplicate");
    expect(retry.ledger).toHaveLength(1);
    expect(retry.event).toEqual(first.event);
  });

  it("rejects an idempotency-key collision with changed content", () => {
    const first = appendSyntheticClaimAuditEvent([], input());

    expect(() =>
      appendSyntheticClaimAuditEvent(
        first.ledger,
        input({
          event_hash: "synthetic_hash_changed",
          event_id: "synthetic_event_changed",
        }),
      ),
    ).toThrow("Conflicting synthetic audit idempotency key");
  });

  it.each(["raw_secret", "document_body", "unsafe_filename", "owner_email"])(
    "rejects the forbidden field %s",
    (field) => {
      expect(() =>
        appendSyntheticClaimAuditEvent([], {
          ...input(),
          [field]: "must-not-be-recorded",
        }),
      ).toThrow(`forbidden field: ${field}`);
    },
  );

  it("rejects non-synthetic identifiers and non-allowlisted events", () => {
    expect(() =>
      appendSyntheticClaimAuditEvent([], input({ case_id: "real-case-id" })),
    ).toThrow("case ID is invalid");
    expect(() =>
      appendSyntheticClaimAuditEvent([], {
        ...input(),
        event_type: "vault_plaintext_viewed",
      }),
    ).toThrow("event type is not allowlisted");
  });

  it("detects sequence, chain, duplicate, clock, and case-boundary corruption", () => {
    const first = appendSyntheticClaimAuditEvent([], input()).event;
    const corrupted: SyntheticClaimAuditEventV1 = {
      ...first,
      case_id: "synthetic_case_other",
      event_id: first.event_id,
      event_hash: first.event_hash,
      idempotency_key: first.idempotency_key,
      previous_event_hash: "synthetic_hash_wrong",
      sequence: 3,
      server_time: "2026-08-01T08:59:00.000Z",
    };

    const issues = reconcileSyntheticClaimAuditLedger([first, corrupted]);
    expect(issues.join("\n")).toMatch(/case boundary/);
    expect(issues.join("\n")).toMatch(/sequence gap/);
    expect(issues.join("\n")).toMatch(/integrity chain/);
    expect(issues.join("\n")).toMatch(/server time backwards/);
    expect(issues.join("\n")).toMatch(/Duplicate synthetic audit event ID/);
    expect(issues.join("\n")).toMatch(/Duplicate synthetic audit event hash/);
    expect(issues.join("\n")).toMatch(/Duplicate synthetic audit idempotency key/);
  });

  it("remains runtime-disconnected and does not calculate a fake production hash", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./audit.ts", import.meta.url)),
      "utf8",
    );

    for (const forbidden of [
      "@supabase/",
      "fetch(",
      "process.env",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "createHash(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
