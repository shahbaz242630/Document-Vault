import type { Context } from "hono";
import { z } from "zod";

import { isRequestBodyTooLarge, readBearerToken } from "../security/http.js";
import {
  ClaimantCapabilityDisabledError,
  getClaimantRuntimeConfig,
  requireClaimantCapability,
  type ClaimantRuntimeConfig,
} from "./runtime-config.js";
import {
  createRegisteredRecipientSupabaseClient,
  RegisteredRecipientMutationError,
  type RegisteredRecipientClient,
  type RegisteredRecipientSupabaseConfig,
} from "./registered-recipient-client.js";
import {
  ClaimantAssuranceError,
  requireFreshClaimantAssurance,
} from "./session-assurance.js";

const MAX_REQUEST_BODY_BYTES = 8192;
const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const uuidSchema = z.string().uuid();
const base64UrlCoordinateSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const issueInvitationSchema = z.strictObject({
  expiresAt: z.iso.datetime({ offset: true }),
  recipientAddressDigest: digestSchema,
});

const acceptInvitationSchema = z.strictObject({
  deviceBindingDigest: digestSchema,
  expectedInvitationVersion: z.number().int().positive(),
  policyPackId: z.string().trim().min(1).max(200),
  policyPackVersion: z.number().int().positive(),
  publicKeyJwk: z.strictObject({
    crv: z.literal("P-256"),
    kty: z.literal("EC"),
    x: base64UrlCoordinateSchema,
    y: base64UrlCoordinateSchema,
  }),
  recipientAddressDigest: digestSchema,
});
const emptyBodySchema = z.strictObject({});

type RegisteredRecipientRouteConfig = RegisteredRecipientSupabaseConfig & Readonly<{
  allowedOrigins: readonly string[];
  freshAssuranceSeconds: number;
}>;

export type RegisteredRecipientRouteDeps = Readonly<{
  createClient?: (config: RegisteredRecipientSupabaseConfig) => RegisteredRecipientClient;
  getConfig?: () => RegisteredRecipientRouteConfig | null;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

export type PreparedRequest = Readonly<{
  client: RegisteredRecipientClient;
  freshAssuranceSeconds: number;
  idempotencyKey: string;
  jwt: string;
}>;

export type PreparationResult = PreparedRequest | Response;
export type JsonBodyResult =
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "tooLarge" }>
  | Readonly<{ kind: "valid"; value: unknown }>;

export function createIssueRegisteredInvitationRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRegisteredRecipientRequest(context, deps);
    if (prepared instanceof Response) return prepared;

    const body = await readRegisteredRecipientJson(context);
    if (body.kind === "tooLarge") return context.json({ error: "Payload too large" }, 413);
    if (body.kind === "invalid") return invalidRegisteredRecipientRequest(context);
    const parsed = issueInvitationSchema.safeParse(body.value);
    if (!parsed.success) return invalidRegisteredRecipientRequest(context);

    const session = await authenticateActiveSession(
      context, prepared.client, prepared.jwt, prepared.freshAssuranceSeconds,
    );
    if (session instanceof Response) return session;

    return runRegisteredRecipientMutation(context, () => prepared.client.issueInvitation({
      expiresAt: parsed.data.expiresAt,
      idempotencyKey: prepared.idempotencyKey,
      ownerUserId: session.userId,
      recipientAddressDigest: parsed.data.recipientAddressDigest,
    }));
  };
}

export function createAcceptRegisteredInvitationRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRegisteredRecipientRequest(context, deps);
    if (prepared instanceof Response) return prepared;

    const invitationId = uuidSchema.safeParse(context.req.param("invitationId"));
    const body = await readRegisteredRecipientJson(context);
    if (body.kind === "tooLarge") return context.json({ error: "Payload too large" }, 413);
    if (body.kind === "invalid") return invalidRegisteredRecipientRequest(context);
    const parsed = acceptInvitationSchema.safeParse(body.value);
    if (!invitationId.success || !parsed.success) return invalidRegisteredRecipientRequest(context);

    const session = await authenticateActiveSession(
      context, prepared.client, prepared.jwt, prepared.freshAssuranceSeconds,
    );
    if (session instanceof Response) return session;

    return runRegisteredRecipientMutation(context, () => prepared.client.acceptInvitation({
      claimantUserId: session.userId,
      deviceBindingDigest: parsed.data.deviceBindingDigest,
      expectedInvitationVersion: parsed.data.expectedInvitationVersion,
      idempotencyKey: prepared.idempotencyKey,
      invitationId: invitationId.data,
      policyPackId: parsed.data.policyPackId,
      policyPackVersion: parsed.data.policyPackVersion,
      publicKeyJwk: parsed.data.publicKeyJwk,
      recipientAddressDigest: parsed.data.recipientAddressDigest,
    }));
  };
}

export function createActivateClaimantSessionRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRegisteredRecipientRequest(context, deps);
    if (prepared instanceof Response) return prepared;
    const body = await readRegisteredRecipientJson(context);
    if (body.kind === "tooLarge") return context.json({ error: "Payload too large" }, 413);
    if (body.kind !== "valid" || !emptyBodySchema.safeParse(body.value).success) {
      return invalidRegisteredRecipientRequest(context);
    }

    const session = await authenticateSession(context, prepared.client, prepared.jwt);
    if (session instanceof Response) return session;
    try {
      const assurance = requireFreshClaimantAssurance(
        session, Math.floor(Date.now() / 1000), prepared.freshAssuranceSeconds,
      );
      return runRegisteredRecipientMutation(context, () => prepared.client.activateSession({
        authenticatedAt: assurance.authenticatedAt,
        idempotencyKey: prepared.idempotencyKey,
        sessionId: session.sessionId,
        userId: session.userId,
      }));
    } catch (error) {
      return assuranceErrorResponse(context, error);
    }
  };
}

export function createRevokeClaimantSessionRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRegisteredRecipientRequest(context, deps);
    if (prepared instanceof Response) return prepared;
    const body = await readRegisteredRecipientJson(context);
    if (body.kind === "tooLarge") return context.json({ error: "Payload too large" }, 413);
    if (body.kind !== "valid" || !emptyBodySchema.safeParse(body.value).success) {
      return invalidRegisteredRecipientRequest(context);
    }

    const session = await authenticateSession(context, prepared.client, prepared.jwt);
    if (session instanceof Response) return session;
    try {
      requireFreshClaimantAssurance(
        session, Math.floor(Date.now() / 1000), prepared.freshAssuranceSeconds,
      );
      return runRegisteredRecipientMutation(context, () => prepared.client.revokeSession({
        idempotencyKey: prepared.idempotencyKey,
        sessionId: session.sessionId,
        userId: session.userId,
      }));
    } catch (error) {
      return assuranceErrorResponse(context, error);
    }
  };
}

export function createRegisteredRecipientPreflightRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return (context: Context): Response => {
    try {
      requireClaimantCapability(
        deps.runtimeConfig ?? getClaimantRuntimeConfig(),
        "registeredRecipient",
      );
    } catch (error) {
      if (error instanceof ClaimantCapabilityDisabledError) {
        return context.json({ error: "Not found" }, 404);
      }
      throw error;
    }

    const config = (deps.getConfig ?? getRegisteredRecipientRouteConfig)();
    const origin = context.req.header("Origin");
    if (!config) return context.json({ error: "Service unavailable" }, 503);
    if (!isAllowedOrigin(origin, config.allowedOrigins)) {
      return context.json({ error: "Forbidden" }, 403);
    }
    if (!isValidPreflight(context)) return context.json({ error: "Forbidden" }, 403);

    setCorsHeaders(context, origin!);
    context.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST");
    context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

export function prepareRegisteredRecipientRequest(
  context: Context,
  deps: RegisteredRecipientRouteDeps,
): PreparationResult {
  try {
    requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "registeredRecipient");
  } catch (error) {
    if (error instanceof ClaimantCapabilityDisabledError) {
      return context.json({ error: "Not found" }, 404);
    }
    throw error;
  }

  const config = (deps.getConfig ?? getRegisteredRecipientRouteConfig)();
  if (!config) return context.json({ error: "Service unavailable" }, 503);
  if (!isAllowedOrigin(context.req.header("Origin"), config.allowedOrigins)) {
    return context.json({ error: "Forbidden" }, 403);
  }
  setCorsHeaders(context, context.req.header("Origin")!);
  if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") {
    return context.json({ error: "Unsupported media type" }, 415);
  }
  if (isRequestBodyTooLarge(context, MAX_REQUEST_BODY_BYTES)) {
    return context.json({ error: "Payload too large" }, 413);
  }

  const jwt = readBearerToken(context.req.header("Authorization"));
  const idempotencyKey = uuidSchema.safeParse(context.req.header("Idempotency-Key")?.trim());
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  if (!idempotencyKey.success) return invalidRegisteredRecipientRequest(context);

  return {
    client: (deps.createClient ?? createRegisteredRecipientSupabaseClient)(config),
    freshAssuranceSeconds: config.freshAssuranceSeconds,
    idempotencyKey: idempotencyKey.data,
    jwt,
  };
}

async function authenticateSession(
  context: Context,
  client: RegisteredRecipientClient,
  jwt: string,
) {
  try {
    return await client.getSession(jwt);
  } catch {
    return context.json({ error: "Unauthorized" }, 401);
  }
}

export async function authenticateActiveSession(
  context: Context,
  client: RegisteredRecipientClient,
  jwt: string,
  freshAssuranceSeconds: number,
) {
  const session = await authenticateSession(context, client, jwt);
  if (session instanceof Response) return session;
  try {
    requireFreshClaimantAssurance(
      session, Math.floor(Date.now() / 1000), freshAssuranceSeconds,
    );
    await client.assertActiveSession(session.userId, session.sessionId);
    return session;
  } catch (error) {
    return assuranceErrorResponse(context, error);
  }
}

function assuranceErrorResponse(context: Context, error: unknown): Response {
  if (error instanceof ClaimantAssuranceError) {
    return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  }
  if (error instanceof RegisteredRecipientMutationError && error.code === "28000") {
    return context.json({ error: "Session inactive" }, 401);
  }
  return mutationErrorResponse(context, error);
}

export async function readRegisteredRecipientJson(context: Context): Promise<JsonBodyResult> {
  try {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) {
      return { kind: "tooLarge" };
    }
    return { kind: "valid", value: JSON.parse(text) };
  } catch {
    return { kind: "invalid" };
  }
}

export async function runRegisteredRecipientMutation(
  context: Context,
  mutation: () => Promise<object>,
): Promise<Response> {
  try {
    const result = await mutation();
    return context.json({ result }, 200);
  } catch (error) {
    return mutationErrorResponse(context, error);
  }
}

function mutationErrorResponse(context: Context, error: unknown): Response {
  if (!(error instanceof RegisteredRecipientMutationError)) {
    return context.json({ error: "Request could not be completed" }, 500);
  }
  if (error.code === "P0001" || error.code === "P0002" || error.code === "42501") {
    return context.json({ error: "Not found" }, 404);
  }
  if (["22023", "23505", "23514", "40001"].includes(error.code ?? "")) {
    return context.json({ error: "Request conflict" }, 409);
  }
  return context.json({ error: "Request could not be completed" }, 500);
}

export function invalidRegisteredRecipientRequest(context: Context): Response {
  return context.json({ error: "Invalid request" }, 400);
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return Boolean(origin && allowedOrigins.includes(origin));
}

function isValidPreflight(context: Context): boolean {
  if (context.req.header("Access-Control-Request-Method")?.trim().toUpperCase() !== "POST") {
    return false;
  }
  const requestedHeaders = context.req.header("Access-Control-Request-Headers")
    ?.split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  const allowedHeaders = new Set(["authorization", "content-type", "idempotency-key"]);
  return Boolean(requestedHeaders?.length && requestedHeaders.every((header) => allowedHeaders.has(header)));
}

function setCorsHeaders(context: Context, origin: string): void {
  context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store");
  context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff");
}

function getRegisteredRecipientRouteConfig(): RegisteredRecipientRouteConfig | null {
  const allowedOrigins = process.env.CLAIMANT_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const freshAssuranceSeconds = Number(
    process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600",
  );

  if (
    !allowedOrigins?.length || !serviceRoleKey || !supabaseUrl ||
    !Number.isInteger(freshAssuranceSeconds) ||
    freshAssuranceSeconds < 60 || freshAssuranceSeconds > 600
  ) return null;
  return { allowedOrigins, freshAssuranceSeconds, serviceRoleKey, supabaseUrl };
}
