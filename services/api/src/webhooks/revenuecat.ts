import type { Context } from "hono";
import { z } from "zod";

const eventSchema = z.object({
  event: z.object({
    app_user_id: z.string(),
    entitlements: z.record(z.string(), z.unknown()).default({}),
    type: z.string(),
  }),
});

export type RevenueCatWebhookEvent = z.infer<typeof eventSchema>;

function getWebhookSecret(): string | null {
  return process.env.REVENUECAT_WEBHOOK_SECRET?.trim() ?? null;
}

export async function revenueCatWebhookHandler(context: Context) {
  const secret = getWebhookSecret();
  if (!secret) {
    return context.json({ error: "Webhook not configured" }, 503);
  }

  const authorization = context.req.header("Authorization")?.trim();
  if (authorization !== secret) {
    return context.json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Invalid JSON" }, 400);
  }

  const parseResult = eventSchema.safeParse(body);
  if (!parseResult.success) {
    return context.json({ error: "Invalid payload" }, 400);
  }

  const { event } = parseResult.data;
  const isPremium = Object.keys(event.entitlements).includes("premium");

  // TODO: Sync entitlement state to Supabase when credentials are available.
  //       Use event.app_user_id to look up the user and update their premium flag.
  //       Consider idempotency: RevenueCat may retry webhooks, so check event_id
  //       or compare timestamps before writing.

  return context.json({ ok: true }, 200);
}
