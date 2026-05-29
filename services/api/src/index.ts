import { Hono } from "hono";

import { revenueCatWebhookHandler } from "./webhooks/revenuecat";

export const app = new Hono();

app.get("/health", (context) => {
  return context.json({ ok: true, service: "sanduqkin-api" });
});

app.post("/webhooks/revenuecat", revenueCatWebhookHandler);
