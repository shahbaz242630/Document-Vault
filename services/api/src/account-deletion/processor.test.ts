import { describe, expect, it } from "vitest";

import { processDueAccountDeletionRequests } from "./processor";
import type { AccountDeletionProcessorClient } from "./processor";

describe("processDueAccountDeletionRequests", () => {
  it("soft-deletes due users and marks their requests completed", async () => {
    const client = createProcessorClientDouble([
      {
        id: "request-1",
        scheduled_for: "2026-06-01T10:00:00.000Z",
        status: "pending",
        user_id: "user-1",
      },
    ]);

    const summary = await processDueAccountDeletionRequests({
      client,
      limit: 10,
      now: new Date("2026-06-01T14:00:00.000Z"),
    });

    expect(summary).toEqual({ completed: 1, failed: 0, selected: 1 });
    expect(client.calls).toEqual([
      {
        method: "selectDue",
        scheduledBefore: "2026-06-01T14:00:00.000Z",
        limit: 10,
      },
      {
        method: "markProcessing",
        requestId: "request-1",
      },
      {
        method: "deleteUser",
        shouldSoftDelete: true,
        userId: "user-1",
      },
      {
        method: "markCompleted",
        requestId: "request-1",
      },
    ]);
  });

  it("marks requests failed when auth deletion fails", async () => {
    const client = createProcessorClientDouble(
      [
        {
          id: "request-1",
          scheduled_for: "2026-06-01T10:00:00.000Z",
          status: "pending",
          user_id: "user-1",
        },
      ],
      { deleteError: "Storage ownership blocks deletion" },
    );

    const summary = await processDueAccountDeletionRequests({
      client,
      now: new Date("2026-06-01T14:00:00.000Z"),
    });

    expect(summary).toEqual({ completed: 0, failed: 1, selected: 1 });
    expect(client.calls.at(-1)).toEqual({
      errorMessage: "Storage ownership blocks deletion",
      method: "markFailed",
      requestId: "request-1",
    });
  });
});

type Call =
  | { method: "selectDue"; scheduledBefore: string; limit: number }
  | { method: "markProcessing"; requestId: string }
  | { method: "deleteUser"; shouldSoftDelete: boolean; userId: string }
  | { method: "markCompleted"; requestId: string }
  | { errorMessage: string; method: "markFailed"; requestId: string };

function createProcessorClientDouble(
  rows: Array<{
    id: string;
    scheduled_for: string;
    status: "pending";
    user_id: string;
  }>,
  options?: { deleteError?: string },
): AccountDeletionProcessorClient & { calls: Call[] } {
  const calls: Call[] = [];

  return {
    calls,
    async deleteAuthUser(userId, shouldSoftDelete) {
      calls.push({ method: "deleteUser", shouldSoftDelete, userId });

      if (options?.deleteError) {
        throw new Error(options.deleteError);
      }
    },
    async markCompleted(requestId) {
      calls.push({ method: "markCompleted", requestId });
    },
    async markFailed(requestId, errorMessage) {
      calls.push({ errorMessage, method: "markFailed", requestId });
    },
    async markProcessing(requestId) {
      calls.push({ method: "markProcessing", requestId });
    },
    async selectDueRequests({ limit, scheduledBefore }) {
      calls.push({ limit, method: "selectDue", scheduledBefore });

      return rows;
    },
  };
}
