import type { Context } from "hono";
import { z } from "zod";

import { createOfflineCodeV2HandoffService, handoffCompleteSchema, handoffIssueSchema }
  from "./offline-code-v2-handoff-service.js";
import { getClaimantRuntimeConfig, requireClaimantCapability, type ClaimantRuntimeConfig }
  from "./runtime-config.js";

export const CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED = false as const;
type Deps = Readonly<{
  approved?: boolean;
  runtimeConfig?: ClaimantRuntimeConfig;
  config?: Readonly<{ apiOrigin: string; claimantOrigin: string }>;
  service?: ReturnType<typeof createOfflineCodeV2HandoffService>;
  createService?: () => ReturnType<typeof createOfflineCodeV2HandoffService>;
}>;
const limit = 16_384;

// Deliberately has no production importer or ambient credential/configuration path.
export function createOfflineCodeV2HandoffController(action: "issue" | "complete", deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED)) return concealed(context);
    try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "offlineCodeV2"); }
    catch { return concealed(context); }
    const config = deps.config;
    if (!config || !validOrigin(config.apiOrigin) || !validOrigin(config.claimantOrigin)
      || new URL(context.req.url).origin !== config.apiOrigin
      || context.req.header("Origin") !== config.claimantOrigin || context.req.header("Cookie")
      || context.req.method !== "POST") return concealed(context);
    context.header("Cache-Control", "private, no-store"); context.header("Pragma", "no-cache");
    context.header("X-Robots-Tag", "noindex, nofollow"); context.header("Referrer-Policy", "no-referrer");
    context.header("X-Content-Type-Options", "nosniff"); context.header("Vary", "Origin");
    context.header("Access-Control-Allow-Origin", config.claimantOrigin);
    const authorization = context.req.header("Authorization");
    const match = authorization?.match(/^Bearer ([^\s,]+)$/u);
    const key = z.string().uuid().safeParse(context.req.header("Idempotency-Key"));
    if (!match || !key.success) return unavailable(context);
    if (context.req.header("Content-Type") !== "application/json") return unavailable(context);
    const declared = context.req.header("Content-Length");
    if (declared && (!/^\d+$/u.test(declared) || Number(declared) > limit)) return unavailable(context);
    try {
      const body = await boundedBody(context);
      const parsed = (action === "issue" ? handoffIssueSchema : handoffCompleteSchema).safeParse(body);
      if (!parsed.success) return unavailable(context);
      const service = deps.service ?? deps.createService?.();
      if (!service) return unavailable(context);
      const result = await service[action](match[1], key.data, parsed.data);
      return context.json({ result });
    } catch { return unavailable(context); }
  };
}
export function createOfflineCodeV2HandoffPreflightController(deps: Deps = {}) {
  return (context: Context): Response => {
    if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED)) return concealed(context);
    try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "offlineCodeV2"); }
    catch { return concealed(context); }
    const config = deps.config;
    const headers = context.req.header("Access-Control-Request-Headers");
    if (!config || !validOrigin(config.apiOrigin) || !validOrigin(config.claimantOrigin)
      || new URL(context.req.url).origin !== config.apiOrigin
      || context.req.header("Origin") !== config.claimantOrigin
      || context.req.header("Access-Control-Request-Method") !== "POST"
      || headers !== "Authorization, Content-Type, Idempotency-Key") return concealed(context);
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": config.claimantOrigin,
      "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": headers,
      "Access-Control-Max-Age": "600", "Cache-Control": "private, no-store", Vary: "Origin",
    } });
  };
}
async function boundedBody(context: Context): Promise<unknown> {
  const reader = context.req.raw.body?.getReader();
  if (!reader) throw new Error();
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error(); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
function validOrigin(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === value; }
  catch { return false; }
}
function concealed(context: Context) { return context.json({ error: "Not found" }, 404); }
function unavailable(context: Context) { return context.json({ error: "Offline-code handoff is unavailable." }, 403); }
