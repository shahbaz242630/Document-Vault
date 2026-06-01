import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createAccountDeletionProcessorRoute } from "./routes";

describe("account deletion processor route", () => {
  it("rejects requests without the internal processor token", async () => {
    const app = new Hono();
    app.post(
      "/internal/account-deletion/process",
      createAccountDeletionProcessorRoute({
        getConfig: () => ({
          processorToken: "processor-token",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        processDueRequests: async () => ({ completed: 0, failed: 0, selected: 0 }),
      }),
    );

    const response = await app.request("/internal/account-deletion/process", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("runs the processor when the internal token is valid", async () => {
    const app = new Hono();
    const calls: unknown[] = [];
    app.post(
      "/internal/account-deletion/process",
      createAccountDeletionProcessorRoute({
        getConfig: () => ({
          processorToken: "processor-token",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        processDueRequests: async (input) => {
          calls.push(input);

          return { completed: 1, failed: 0, selected: 1 };
        },
      }),
    );

    const response = await app.request("/internal/account-deletion/process", {
      headers: { Authorization: "Bearer processor-token" },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({
      completed: 1,
      failed: 0,
      ok: true,
      selected: 1,
    });
    expect(calls).toHaveLength(1);
  });
});
