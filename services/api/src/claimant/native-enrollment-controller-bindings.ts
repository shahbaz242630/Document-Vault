import { createHash, createHmac } from "node:crypto";

import { APP_ATTEST_KEY_ID_DIGEST_LABEL_V1 } from "@vault/shared-types";
import { deriveInvitationAddressIndexV1, normalizeInvitationAddressV1 } from "./invitation-address-v1.js";

const DEVICE_BINDING_LABEL_V1 = "sanduqkin:claim:native-enrollment:device-binding:v1";

export function deriveConfirmedRecipientAddressDigestV1(key: Uint8Array, address: string): string {
  return Buffer.from(deriveInvitationAddressIndexV1(key, normalizeInvitationAddressV1(address))).toString("hex");
}

export function deriveControllerAppAttestKeyIdDigestV1(appAttestKeyId: string): string {
  if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u.test(appAttestKeyId)) fail();
  const keyId = Buffer.from(appAttestKeyId, "base64");
  if (keyId.byteLength !== 32 || keyId.toString("base64") !== appAttestKeyId) fail();
  return createHash("sha256").update(APP_ATTEST_KEY_ID_DIGEST_LABEL_V1, "utf8")
    .update(Uint8Array.of(0)).update(keyId).digest("base64url");
}

export function deriveControllerDeviceBindingDigestV1(
  key: Uint8Array,
  claimantUserId: string,
  appAttestKeyIdDigest: string,
): string {
  if (key.byteLength !== 32 || !/^[0-9a-f-]{36}$/u.test(claimantUserId) ||
      !/^[A-Za-z0-9_-]{43}$/u.test(appAttestKeyIdDigest)) fail();
  return createHmac("sha256", key).update(DEVICE_BINDING_LABEL_V1, "utf8")
    .update(Uint8Array.of(0)).update(claimantUserId, "utf8").update(Uint8Array.of(0))
    .update(appAttestKeyIdDigest, "ascii").digest("hex");
}

function fail(): never { throw new Error("Native enrollment controller binding is invalid."); }
