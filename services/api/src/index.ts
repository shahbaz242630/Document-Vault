import { Hono } from "hono";

import { createAuditRetentionProcessorRoute } from "./audit-retention/routes.js";
import { createAccountDeletionProcessorRoute } from "./account-deletion/routes.js";
import { createAccountDeletionRequestRoute } from "./account-deletion/request-route.js";
import { getClaimantRuntimeConfig } from "./claimant/runtime-config.js";
import {
  createClaimantPortalPreflightRoute,
  createClaimantPortalSessionRoute,
} from "./claimant/portal-session-routes.js";
import {
  createAcceptRegisteredInvitationRoute,
  createActivateClaimantSessionRoute,
  createIssueRegisteredInvitationRoute,
  createRegisteredRecipientPreflightRoute,
  createRevokeClaimantSessionRoute,
} from "./claimant/registered-recipient-routes.js";
import {
  createEnrollClaimantDeviceRoute,
  createFinalizeRegisteredRecipientRoute,
  createReplaceClaimantDeviceRoute,
  createRevokeClaimantDeviceRoute,
  createRevokeRegisteredInvitationRoute,
} from "./claimant/registered-recipient-lifecycle-routes.js";
import {
  createNativeEnrollmentPreflightRouteV1,
  createNativeEnrollmentRouteV1,
} from "./claimant/native-enrollment-routes.js";
import { createClaimantUploadControllerV1, createClaimantUploadPreflightControllerV1 }
  from "./claimant/claimant-upload-controller.js";
import { createClaimSubmissionControllerV1, createClaimSubmissionPreflightControllerV1 }
  from "./claimant/claim-submission-controller.js";
import { revenueCatWebhookHandler } from "./webhooks/revenuecat.js";

export const app = new Hono();
export const claimantRuntimeConfig = getClaimantRuntimeConfig();

app.get("/health", (context) => {
  context.header("Cache-Control", "no-store");
  context.header("Cross-Origin-Resource-Policy", "same-origin");
  context.header("X-Content-Type-Options", "nosniff");
  return context.json({ ok: true, service: "sanduqkin-api" });
});

app.post("/webhooks/revenuecat", revenueCatWebhookHandler);
app.post("/account-deletion/request", createAccountDeletionRequestRoute());
app.post("/internal/account-deletion/process", createAccountDeletionProcessorRoute());
app.post("/internal/audit-retention/process", createAuditRetentionProcessorRoute());
app.post(
  "/claimant/registered-recipient/invitations",
  createIssueRegisteredInvitationRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/session/activate",
  createActivateClaimantSessionRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/session/revoke",
  createRevokeClaimantSessionRoute({ runtimeConfig: claimantRuntimeConfig }),
);
for (const action of ["activate", "assert", "revoke"] as const) {
  const path = `/claimant/portal/session/${action}`;
  app.post(path, createClaimantPortalSessionRoute(action, { runtimeConfig: claimantRuntimeConfig }));
  app.options(path, createClaimantPortalPreflightRoute({ runtimeConfig: claimantRuntimeConfig }));
}
app.options(
  "/claimant/session/activate",
  createRegisteredRecipientPreflightRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.options(
  "/claimant/session/revoke",
  createRegisteredRecipientPreflightRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.options(
  "/claimant/registered-recipient/invitations",
  createRegisteredRecipientPreflightRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.options(
  "/claimant/registered-recipient/invitations/:invitationId/accept",
  createRegisteredRecipientPreflightRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/invitations/:invitationId/accept",
  createAcceptRegisteredInvitationRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/invitations/:invitationId/revoke",
  createRevokeRegisteredInvitationRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/cases/:caseId/device-keys",
  createEnrollClaimantDeviceRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/cases/:caseId/device-keys/:keyId/replace",
  createReplaceClaimantDeviceRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/cases/:caseId/device-keys/:keyId/revoke",
  createRevokeClaimantDeviceRoute({ runtimeConfig: claimantRuntimeConfig }),
);
app.post(
  "/claimant/registered-recipient/cases/:caseId/finalize",
  createFinalizeRegisteredRecipientRoute({ runtimeConfig: claimantRuntimeConfig }),
);
for (const lifecyclePath of [
  "/claimant/registered-recipient/invitations/:invitationId/revoke",
  "/claimant/registered-recipient/cases/:caseId/device-keys",
  "/claimant/registered-recipient/cases/:caseId/device-keys/:keyId/replace",
  "/claimant/registered-recipient/cases/:caseId/device-keys/:keyId/revoke",
  "/claimant/registered-recipient/cases/:caseId/finalize",
]) {
  app.options(
    lifecyclePath,
    createRegisteredRecipientPreflightRoute({ runtimeConfig: claimantRuntimeConfig }),
  );
}

for (const [path, action] of [
  ["/claimant/native-enrollment/app-attest/registration/challenges", "registrationIssue"],
  ["/claimant/native-enrollment/app-attest/registration/challenges/:challengeId/complete", "registrationComplete"],
  ["/claimant/native-enrollment/challenges", "nativeIssue"],
  ["/claimant/native-enrollment/challenges/:nativeChallengeId/complete", "nativeComplete"],
  ["/claimant/native-enrollment/attempts/:attemptId/reconcile", "reconcile"],
] as const) {
  app.post(path, createNativeEnrollmentRouteV1(action, { runtimeConfig: claimantRuntimeConfig }));
  app.options(path, createNativeEnrollmentPreflightRouteV1({ runtimeConfig: claimantRuntimeConfig }));
}

for (const [path, action, method] of [
  ["/claimant/evidence/cases/:caseId/upload-capabilities", "issue", "post"],
  ["/claimant/evidence/cases/:caseId/objects/:objectId", "upload", "put"],
  ["/claimant/evidence/cases/:caseId/objects/:objectId/reconcile", "reconcile", "post"],
] as const) {
  app[method](path, createClaimantUploadControllerV1(action, { runtimeConfig: claimantRuntimeConfig }));
  app.options(path, createClaimantUploadPreflightControllerV1(action, { runtimeConfig: claimantRuntimeConfig }));
}
const claimSubmissionPath = "/claimant/cases/:caseId/submissions";
app.post(claimSubmissionPath, createClaimSubmissionControllerV1({ runtimeConfig: claimantRuntimeConfig }));
app.options(claimSubmissionPath,
  createClaimSubmissionPreflightControllerV1({ runtimeConfig: claimantRuntimeConfig }));
