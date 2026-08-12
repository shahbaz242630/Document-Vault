import type { Context } from "hono";
import { z } from "zod";

import {
  authenticateActiveSession,
  invalidRegisteredRecipientRequest,
  prepareRegisteredRecipientRequest,
  readRegisteredRecipientJson,
  runRegisteredRecipientMutation,
  type RegisteredRecipientRouteDeps,
} from "./registered-recipient-routes.js";

const uuidSchema = z.string().uuid();
const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const coordinateSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const publicKeySchema = z.strictObject({
  crv: z.literal("P-256"), kty: z.literal("EC"),
  x: coordinateSchema, y: coordinateSchema,
});
const keyMutationSchema = z.strictObject({
  deviceBindingDigest: digestSchema,
  expectedCaseVersion: z.number().int().positive(),
  publicKeyJwk: publicKeySchema,
});
const versionSchema = z.strictObject({ expectedCaseVersion: z.number().int().positive() });
const invitationVersionSchema = z.strictObject({
  expectedInvitationVersion: z.number().int().positive(),
});
const grantSchema = z.strictObject({
  aead: z.literal("xchacha20poly1305_ietf"),
  ciphertext: z.string().regex(/^[A-Za-z0-9_-]{64,}$/),
  created_at: z.iso.datetime({ offset: true }),
  grant_id: uuidSchema,
  grant_version: z.number().int().positive(),
  kdf: z.literal("hkdf_sha256"),
  key_agreement: z.literal("p256_ecdh"),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  owner_ephemeral_public_key: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
  profile: z.literal("registered_recipient_v2"),
  protocol: z.literal("sanduqkin:claim:recipient-grant:v2"),
  recipient_id: uuidSchema,
  recipient_key_id: uuidSchema,
  recipient_key_version: z.number().int().positive(),
  revoked_at: z.null(),
});
const finalizationSchema = z.strictObject({
  expectedCaseVersion: z.number().int().positive(),
  grants: z.array(grantSchema).min(2).max(5),
});

export function createEnrollClaimantDeviceRoute(deps: RegisteredRecipientRouteDeps = {}) {
  return createKeyMutationRoute("enroll", deps);
}

export function createReplaceClaimantDeviceRoute(deps: RegisteredRecipientRouteDeps = {}) {
  return createKeyMutationRoute("replace", deps);
}

export function createRevokeClaimantDeviceRoute(deps: RegisteredRecipientRouteDeps = {}) {
  return createVersionMutationRoute("revoke", deps);
}

export function createFinalizeRegisteredRecipientRoute(deps: RegisteredRecipientRouteDeps = {}) {
  return async (context: Context): Promise<Response> => {
    const authorized = await prepareLifecycleRequest(context, deps, finalizationSchema);
    if (authorized instanceof Response) return authorized;
    return runRegisteredRecipientMutation(context, () => authorized.prepared.client.manageLifecycle({
      action: "finalize", actorUserId: authorized.session.userId,
      caseId: authorized.caseId, deviceBindingDigest: null,
      expectedCaseVersion: authorized.body.expectedCaseVersion,
      grants: authorized.body.grants, idempotencyKey: authorized.prepared.idempotencyKey,
      publicKeyJwk: null, targetKeyId: null,
    }));
  };
}

export function createRevokeRegisteredInvitationRoute(
  deps: RegisteredRecipientRouteDeps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepareRegisteredRecipientRequest(context, deps);
    if (prepared instanceof Response) return prepared;
    const invitationId = uuidSchema.safeParse(context.req.param("invitationId"));
    const body = await readRegisteredRecipientJson(context);
    if (!invitationId.success || body.kind !== "valid") {
      return invalidRegisteredRecipientRequest(context);
    }
    const parsed = invitationVersionSchema.safeParse(body.value);
    if (!parsed.success) return invalidRegisteredRecipientRequest(context);
    const session = await authenticateActiveSession(
      context, prepared.client, prepared.jwt, prepared.freshAssuranceSeconds,
    );
    if (session instanceof Response) return session;
    return runRegisteredRecipientMutation(context, () => prepared.client.revokeInvitation({
      expectedVersion: parsed.data.expectedInvitationVersion,
      idempotencyKey: prepared.idempotencyKey,
      invitationId: invitationId.data,
      ownerUserId: session.userId,
    }));
  };
}

function createKeyMutationRoute(
  action: "enroll" | "replace",
  deps: RegisteredRecipientRouteDeps,
) {
  return async (context: Context): Promise<Response> => {
    const authorized = await prepareLifecycleRequest(context, deps, keyMutationSchema);
    if (authorized instanceof Response) return authorized;
    const targetKeyId = action === "replace" ? authorized.targetKeyId : null;
    if (action === "replace" && !targetKeyId) return invalidRegisteredRecipientRequest(context);
    return runRegisteredRecipientMutation(context, () => authorized.prepared.client.manageLifecycle({
      action, actorUserId: authorized.session.userId, caseId: authorized.caseId,
      deviceBindingDigest: authorized.body.deviceBindingDigest,
      expectedCaseVersion: authorized.body.expectedCaseVersion, grants: null,
      idempotencyKey: authorized.prepared.idempotencyKey,
      publicKeyJwk: authorized.body.publicKeyJwk, targetKeyId,
    }));
  };
}

function createVersionMutationRoute(
  action: "revoke",
  deps: RegisteredRecipientRouteDeps,
) {
  return async (context: Context): Promise<Response> => {
    const authorized = await prepareLifecycleRequest(context, deps, versionSchema);
    if (authorized instanceof Response) return authorized;
    if (!authorized.targetKeyId) return invalidRegisteredRecipientRequest(context);
    return runRegisteredRecipientMutation(context, () => authorized.prepared.client.manageLifecycle({
      action, actorUserId: authorized.session.userId, caseId: authorized.caseId,
      deviceBindingDigest: null, expectedCaseVersion: authorized.body.expectedCaseVersion,
      grants: null, idempotencyKey: authorized.prepared.idempotencyKey,
      publicKeyJwk: null, targetKeyId: authorized.targetKeyId,
    }));
  };
}

async function prepareLifecycleRequest<T extends z.ZodType>(
  context: Context,
  deps: RegisteredRecipientRouteDeps,
  schema: T,
) {
  const prepared = prepareRegisteredRecipientRequest(context, deps);
  if (prepared instanceof Response) return prepared;
  const caseId = uuidSchema.safeParse(context.req.param("caseId"));
  const target = context.req.param("keyId");
  const targetKeyId = target ? uuidSchema.safeParse(target) : null;
  const body = await readRegisteredRecipientJson(context);
  if (!caseId.success || (targetKeyId && !targetKeyId.success) || body.kind !== "valid") {
    return invalidRegisteredRecipientRequest(context);
  }
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidRegisteredRecipientRequest(context);
  const session = await authenticateActiveSession(
    context, prepared.client, prepared.jwt, prepared.freshAssuranceSeconds,
  );
  if (session instanceof Response) return session;
  return {
    body: parsed.data as z.output<T>, caseId: caseId.data, prepared, session,
    targetKeyId: targetKeyId?.data ?? null,
  };
}
