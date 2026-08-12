import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export type ServerEphemeralKeyCustodyV1 = Readonly<{
  open: (input: Readonly<{ claimantUserId: string; envelope: string; nativeChallengeId: string }>) => Uint8Array;
  seal: (input: Readonly<{ claimantUserId: string; nativeChallengeId: string; privateKey: Uint8Array }>) => string;
}>;

export function createServerEphemeralKeyCustodyV1(masterKey: Uint8Array): ServerEphemeralKeyCustodyV1 {
  if (masterKey.byteLength !== 32) fail();
  const key = Buffer.from(masterKey);
  return {
    open(input) {
      const parts = input.envelope.split(".");
      if (parts.length !== 4 || parts[0] !== VERSION) fail();
      const nonce = decode(parts[1]!, 12); const ciphertext = decode(parts[2]!, 32); const tag = decode(parts[3]!, 16);
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, nonce);
        decipher.setAAD(aad(input.claimantUserId, input.nativeChallengeId));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        if (plaintext.byteLength !== 32) fail();
        return plaintext;
      } catch { fail(); }
    },
    seal(input) {
      if (input.privateKey.byteLength !== 32) fail();
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(aad(input.claimantUserId, input.nativeChallengeId));
      const ciphertext = Buffer.concat([cipher.update(input.privateKey), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, nonce.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
    },
  };
}

export function assertServerEphemeralKeyMatchesEnvelopeV1(left: Uint8Array, right: Uint8Array): void {
  if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) fail();
}

function aad(claimantUserId: string, nativeChallengeId: string): Buffer {
  if (!/^[0-9a-f-]{36}$/u.test(claimantUserId) || !/^[0-9a-f-]{36}$/u.test(nativeChallengeId)) fail();
  return Buffer.from(`sanduqkin:claim:native-enrollment:server-ephemeral-key:v1\0${claimantUserId}\0${nativeChallengeId}`, "utf8");
}
function decode(value: string, length: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== length || decoded.toString("base64url") !== value) fail();
  return decoded;
}
function fail(): never { throw new Error("Server ephemeral-key custody failed."); }
