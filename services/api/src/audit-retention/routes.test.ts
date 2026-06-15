import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createAuditRetentionProcessorRoute } from "./routes";

describe("audit retention processor route", () => {
  it("rejects requests without the internal retention token", async () => {
    const app = new Hono();
    app.post(
      "/internal/audit-retention/process",
      createAuditRetentionProcessorRoute({
        getConfig: () => ({
          processorToken: "retention-token",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        processExpiredEvents: async () => ({ deleted: 0 }),
      }),
    );

    const response = await app.request("/internal/audit-retention/process", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("rejects malformed retention auth schemes without running the processor", async () => {
    const app = new Hono();
    const calls: unknown[] = [];
    app.post(
      "/internal/audit-retention/process",
      createAuditRetentionProcessorRoute({
        getConfig: () => ({
          processorToken: "retention-token",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        processExpiredEvents: async () => {
          calls.push({ method: "processExpiredEvents" });

          return { deleted: 0 };
        },
      }),
    );

    const response = await app.request("/internal/audit-retention/process", {
      headers: { Authorization: "Basic retention-token" },
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("rejects oversized retention processor requests before reading configuration", async () => {
    const app = new Hono();
    const calls: unknown[] = [];
    app.post(
      "/internal/audit-retention/process",
      createAuditRetentionProcessorRoute({
        getConfig: () => {
          calls.push({ method: "getConfig" });

          return {
            processorToken: "retention-token",
            serviceRoleKey: "service-role",
            supabaseUrl: "https://project.supabase.co",
          };
        },
      }),
    );

    const response = await app.request("/internal/audit-retention/process", {
      body: "x",
      headers: {
        Authorization: "Bearer retention-token",
        "Content-Length": "1025",
      },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({ error: "Payload too large" });
    expect(response.status).toBe(413);
    expect(calls).toEqual([]);
  });

  it("runs the retention processor when the internal token is valid", async () => {
    const app = new Hono();
    const calls: unknown[] = [];
    app.post(
      "/internal/audit-retention/process",
      createAuditRetentionProcessorRoute({
        getConfig: () => ({
          processorToken: "retention-token",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        processExpiredEvents: async (input) => {
          calls.push(input);

          return { deleted: 2 };
        },
      }),
    );

    const response = await app.request("/internal/audit-retention/process", {
      headers: { Authorization: "Bearer retention-token" },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({
      deleted: 2,
      ok: true,
    });
    expect(calls).toEqual([
      {
        serviceRoleKey: "service-role",
        supabaseUrl: "https://project.supabase.co",
      },
    ]);
  });
});
