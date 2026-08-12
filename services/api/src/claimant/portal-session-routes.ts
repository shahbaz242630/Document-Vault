import type { Context } from "hono";
import { z } from "zod";

import { isRequestBodyTooLarge, readBearerToken } from "../security/http.js";
import {
  createClaimantPortalSessionClient,
  ClaimantPortalSessionError,
  type ClaimantPortalSessionClient,
} from "./portal-session-client.js";
import type { RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";
import {
  ClaimantCapabilityDisabledError, getClaimantRuntimeConfig,
  requireClaimantCapability, type ClaimantRuntimeConfig,
} from "./runtime-config.js";

const MAX_BODY_BYTES = 1024;
const emptyBodySchema = z.strictObject({});
const uuidSchema = z.string().uuid();

type PortalRouteConfig = RegisteredRecipientSupabaseConfig & Readonly<{
  allowedOrigins: readonly string[];
  freshAssuranceSeconds: number;
}>;

type PortalRouteDeps = Readonly<{
  createClient?: (config: RegisteredRecipientSupabaseConfig) => ClaimantPortalSessionClient;
  getConfig?: () => PortalRouteConfig | null;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

type PortalAction = "activate" | "assert" | "revoke";

export function createClaimantPortalSessionRoute(action: PortalAction, deps: PortalRouteDeps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRequest(context, deps);
    if (prepared instanceof Response) return prepared;
    const body = await readBody(context);
    if (body === "too-large") return context.json({ error: "Payload too large" }, 413);
    if (body === "invalid") return context.json({ error: "Invalid request" }, 400);
    let session;
    try {
      session = await prepared.client.getSession(prepared.jwt);
    } catch {
      return context.json({ error: "Unauthorized" }, 401);
    }
    try {
      const assurance = requireFreshClaimantAssurance(
        session, Math.floor(Date.now() / 1000), prepared.freshAssuranceSeconds,
      );
      const input = {
        idempotencyKey: prepared.idempotencyKey,
        sessionId: session.sessionId,
        userId: session.userId,
      };
      const result = action === "activate"
        ? await prepared.client.activate({ ...input, authenticatedAt: assurance.authenticatedAt })
        : action === "assert"
          ? await prepared.client.assert(input.userId, input.sessionId)
          : await prepared.client.revoke(input);
      return context.json({ result }, 200);
    } catch (error) {
      return portalError(context, error);
    }
  };
}

export function createClaimantPortalPreflightRoute(deps: PortalRouteDeps = {}) {
  return (context: Context): Response => {
    const config = requirePortalConfig(context, deps);
    if (config instanceof Response) return config;
    const origin = context.req.header("Origin");
    if (!origin || !config.allowedOrigins.includes(origin)) return context.json({ error: "Forbidden" }, 403);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = context.req.header("Access-Control-Request-Headers")
      ?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    const allowedHeaders = new Set(["authorization", "content-type", "idempotency-key"]);
    if (method !== "POST" || !headers?.length || !headers.every((value) => allowedHeaders.has(value))) {
      return context.json({ error: "Forbidden" }, 403);
    }
    setResponseHeaders(context, origin);
    context.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST");
    context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

function prepareRequest(context: Context, deps: PortalRouteDeps) {
  const config = requirePortalConfig(context, deps);
  if (config instanceof Response) return config;
  const origin = context.req.header("Origin");
  if (!origin || !config.allowedOrigins.includes(origin)) return context.json({ error: "Forbidden" }, 403);
  setResponseHeaders(context, origin);
  if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") {
    return context.json({ error: "Unsupported media type" }, 415);
  }
  if (isRequestBodyTooLarge(context, MAX_BODY_BYTES)) return context.json({ error: "Payload too large" }, 413);
  const jwt = readBearerToken(context.req.header("Authorization"));
  const idempotencyKey = uuidSchema.safeParse(context.req.header("Idempotency-Key")?.trim());
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  if (!idempotencyKey.success) return context.json({ error: "Invalid request" }, 400);
  return {
    client: (deps.createClient ?? createClaimantPortalSessionClient)(config),
    freshAssuranceSeconds: config.freshAssuranceSeconds,
    idempotencyKey: idempotencyKey.data,
    jwt,
  };
}

function requirePortalConfig(context: Context, deps: PortalRouteDeps): PortalRouteConfig | Response {
  try {
    requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "authentication");
  } catch (error) {
    if (error instanceof ClaimantCapabilityDisabledError) return context.json({ error: "Not found" }, 404);
    throw error;
  }
  const config = (deps.getConfig ?? getPortalRouteConfig)();
  return config ?? context.json({ error: "Service unavailable" }, 503);
}

async function readBody(context: Context): Promise<"invalid" | "too-large" | "valid"> {
  try {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return "too-large";
    return emptyBodySchema.safeParse(JSON.parse(text)).success ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}

function portalError(context: Context, error: unknown): Response {
  if (error instanceof ClaimantAssuranceError) {
    return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  }
  if (error instanceof ClaimantPortalSessionError) {
    if (error.code === "42501") return context.json({ error: "Not found" }, 404);
    if (error.code === "28000") return context.json({ error: "Session inactive" }, 401);
    if (error.code === "22023") return context.json({ error: "Request conflict" }, 409);
  }
  return context.json({ error: "Request could not be completed" }, 500);
}

function setResponseHeaders(context: Context, origin: string): void {
  context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store");
  context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff");
}

function getPortalRouteConfig(): PortalRouteConfig | null {
  const allowedOrigins = process.env.CLAIMANT_PORTAL_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim()).filter(Boolean);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const freshAssuranceSeconds = Number(
    process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600",
  );
  if (!allowedOrigins?.length || !serviceRoleKey || !supabaseUrl ||
      !Number.isInteger(freshAssuranceSeconds) || freshAssuranceSeconds < 60 || freshAssuranceSeconds > 600) {
    return null;
  }
  return { allowedOrigins, freshAssuranceSeconds, serviceRoleKey, supabaseUrl };
}
