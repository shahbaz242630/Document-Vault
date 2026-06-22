import { describe, expect, it } from "vitest";

import { processExpiredAnonymizedAuditEvents } from "./processor";
import type { AuditRetentionProcessorClient } from "./processor";

describe("processExpiredAnonymizedAuditEvents", () => {
  it("deletes anonymized audit rows older than seven years", async () => {
    const client = createClientDouble(3);

    const summary = await processExpiredAnonymizedAuditEvents({
      client,
      now: new Date("2033-06-02T12:00:00.000Z"),
    });

    expect(summary).toEqual({ deleted: 3 });
    expect(client.calls).toEqual([
      {
        method: "deleteAnonymizedBefore",
        occurredBefore: "2026-06-02T12:00:00.000Z",
      },
    ]);
  });
});

function createClientDouble(
  deletedCount: number,
): AuditRetentionProcessorClient & {
  calls: { method: "deleteAnonymizedBefore"; occurredBefore: string }[];
} {
  const calls: { method: "deleteAnonymizedBefore"; occurredBefore: string }[] = [];

  return {
    calls,
    async deleteAnonymizedBefore(occurredBefore) {
      calls.push({ method: "deleteAnonymizedBefore", occurredBefore });

      return deletedCount;
    },
  };
}
