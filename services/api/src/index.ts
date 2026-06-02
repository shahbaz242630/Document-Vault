import { Hono } from "hono";

import { createAccountDeletionProcessorRoute } from "./account-deletion/routes.js";
import { revenueCatWebhookHandler } from "./webhooks/revenuecat.js";

export const app = new Hono();

app.get("/health", (context) => {
  return context.json({ ok: true, service: "sanduqkin-api" });
});

app.post("/webhooks/revenuecat", revenueCatWebhookHandler);
app.post("/internal/account-deletion/process", createAccountDeletionProcessorRoute());
