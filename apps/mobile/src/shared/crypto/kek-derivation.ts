import sodium from "libsodium-wrappers-sumo";

/**
 * BRD §4.2: Argon2id tuned for mobile.
 * Uses libsodium's MODERATE preset for a balance of security and UX:
 * - memory cost: 256 MiB
 * - time cost: 3 iterations
 * - parallelism: 1 (libsodium default)
 *
 * NOTE: Upgraded from 64 MiB (INTERACTIVE) to 256 MiB (MODERATE)
 * following security audit. Budget devices should still handle this
 * comfortably; if OOMs are reported, consider a device-class fallback.
 */
// libsodium MODERATE preset values (must be hard-coded because
// sodium constants are unavailable until sodium.ready resolves).
const OPSLIMIT = 3;
const MEMLIMIT = 256 * 1024 * 1024; // 256 MiB
const KEY_LENGTH = 32; // 256 bits for XChaCha20-Poly1305

export async function generateSalt(): Promise<Uint8Array> {
  await sodium.ready;
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

export async function deriveKEK(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  await sodium.ready;

  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error(
      `Invalid salt length. Expected ${sodium.crypto_pwhash_SALTBYTES}, got ${salt.length}.`,
    );
  }

  if (password.length === 0) {
    throw new Error("Password cannot be empty.");
  }

  return sodium.crypto_pwhash(
    KEY_LENGTH,
    password,
    salt,
    OPSLIMIT,
    MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
