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

type RevenueCatWebhookDeps = {
  getWebhookSecret?: () => string | null;
};

function getRevenueCatWebhookSecret(): string | null {
  return process.env.REVENUECAT_WEBHOOK_SECRET?.trim() ?? null;
}

export function createRevenueCatWebhookHandler(deps: RevenueCatWebhookDeps = {}) {
  return async (context: Context) => {
    const secret = (deps.getWebhookSecret ?? getRevenueCatWebhookSecret)();
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

    return context.json({ entitlementSync: "deferred_phase_1", ok: true }, 200);
  };
}

export const revenueCatWebhookHandler = createRevenueCatWebhookHandler();
