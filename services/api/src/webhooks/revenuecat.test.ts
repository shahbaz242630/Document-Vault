import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createRevenueCatWebhookHandler } from "./revenuecat";

describe("revenueCatWebhookHandler", () => {
  it("rejects requests without the configured webhook secret", async () => {
    const app = createApp();

    const response = await app.request("/webhooks/revenuecat", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid webhook payloads", async () => {
    const app = createApp();

    const response = await app.request("/webhooks/revenuecat", {
      body: JSON.stringify({ event: { type: "INITIAL_PURCHASE" } }),
      headers: {
        Authorization: "webhook-secret",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(400);
  });

  it("acknowledges valid events without syncing entitlements during Phase 1", async () => {
    const app = createApp();

    const response = await app.request("/webhooks/revenuecat", {
      body: JSON.stringify({
        event: {
          app_user_id: "user-1",
          entitlements: {
            premium: {},
          },
          type: "INITIAL_PURCHASE",
        },
      }),
      headers: {
        Authorization: "webhook-secret",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({
      entitlementSync: "deferred_phase_1",
      ok: true,
    });
    expect(response.status).toBe(200);
  });
});

function createApp() {
  const app = new Hono();
  app.post(
    "/webhooks/revenuecat",
    createRevenueCatWebhookHandler({
      getWebhookSecret: () => "webhook-secret",
    }),
  );

  return app;
}
