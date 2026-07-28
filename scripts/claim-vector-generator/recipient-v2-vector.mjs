import { createECDH, createHash, createHmac } from "node:crypto";

const PROTOCOL = "sanduqkin:claim:recipient-grant:v2";
const POSSESSION_LABEL = "sanduqkin:claim:recipient-possession:v2";
const GRANT_WRAP_LABEL = "sanduqkin:claim:recipient-grant-wrap:v2";

export function createRecipientV2Vector({
  base64url,
  canonicalJson,
  ids,
  mek,
  sodium,
  syntheticMeta,
  timestamps,
}) {
  const recipient = deterministicP256Key(1);
  const serverEphemeral = deterministicP256Key(2);
  const ownerEphemeral = deterministicP256Key(3);
  const recipientKeyVersion = 2;
  const recipientKeyFingerprint = sha256(
    concat(
      utf8(PROTOCOL),
      Uint8Array.of(0),
      uint32(recipientKeyVersion),
      recipient.publicKey,
    ),
  );
  const shared = {
    base64url,
    canonicalJson,
    ids,
    recipient,
    recipientKeyFingerprint,
    recipientKeyVersion,
    timestamps,
  };
  const possession = createPossessionProfile({
    ...shared,
    serverEphemeral,
  });
  const grant = createGrantProfile({
    ...shared,
    mek,
    ownerEphemeral,
    sodium,
  });
  return createVectorDocument({
    ...shared,
    grant,
    ownerEphemeral,
    possession,
    serverEphemeral,
    syntheticMeta,
  });
}

function createPossessionProfile({
  base64url,
  canonicalJson,
  ids,
  recipient,
  recipientKeyVersion,
  serverEphemeral,
  timestamps,
}) {
  const challenge = {
    protocol: PROTOCOL,
    challenge_id: ids.challengeV2,
    recipient_id: ids.recipient,
    recipient_key_id: ids.recipientKeyV2,
    recipient_key_version: recipientKeyVersion,
    server_ephemeral_public_key: base64url(serverEphemeral.publicKey),
    nonce: base64url(bytesFromRange(41, 32)),
    origin: "https://app.sanduqkin.test",
    expires_at: timestamps.challengeExpiry,
  };
  const canonical = utf8(canonicalJson(challenge));
  const salt = sha256(
    concat(utf8(POSSESSION_LABEL), Uint8Array.of(0), canonical),
  );
  const macKey = hkdfSha256(
    ecdh(recipient.privateKey, serverEphemeral.publicKey),
    salt,
    utf8(POSSESSION_LABEL),
    32,
  );
  return {
    challenge,
    canonical,
    salt,
    mac: hmacSha256(macKey, canonical),
  };
}

function createGrantProfile({
  base64url,
  canonicalJson,
  ids,
  mek,
  ownerEphemeral,
  recipient,
  recipientKeyFingerprint,
  recipientKeyVersion,
  sodium,
  timestamps,
}) {
  const commonBindings = {
    protocol: PROTOCOL,
    grant_id: ids.grantV2,
    owner_id: ids.owner,
    recipient_id: ids.recipient,
    recipient_key_id: ids.recipientKeyV2,
    recipient_key_version: recipientKeyVersion,
    recipient_key_fingerprint: base64url(recipientKeyFingerprint),
  };
  const plaintext = {
    ...commonBindings,
    issued_at: timestamps.created,
    grant_nonce: base64url(bytesFromRange(73, 16)),
    mek: base64url(mek),
  };
  const associatedData = {
    ...commonBindings,
    profile: "registered_recipient_v2",
    owner_ephemeral_public_key: base64url(ownerEphemeral.publicKey),
    created_at: timestamps.created,
  };
  const canonicalPlaintext = utf8(canonicalJson(plaintext));
  const canonicalAssociatedData = utf8(canonicalJson(associatedData));
  const salt = sha256(
    concat(utf8(GRANT_WRAP_LABEL), Uint8Array.of(0), canonicalAssociatedData),
  );
  const wrapKey = hkdfSha256(
    ecdh(ownerEphemeral.privateKey, recipient.publicKey),
    salt,
    utf8(GRANT_WRAP_LABEL),
    32,
  );
  const nonce = bytesFromRange(89, 24);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    canonicalPlaintext,
    canonicalAssociatedData,
    null,
    nonce,
    wrapKey,
  );
  const opened = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    canonicalAssociatedData,
    nonce,
    wrapKey,
  );
  if (canonicalJson(JSON.parse(sodium.to_string(opened))) !== sodium.to_string(opened)) {
    throw new Error("Deterministic recipient V2 fixture did not open canonically.");
  }
  return {
    associatedData,
    canonicalAssociatedData,
    canonicalPlaintext,
    ciphertext,
    nonce,
    plaintext,
    salt,
    wrapKey,
  };
}

function createVectorDocument({
  base64url,
  grant,
  ids,
  ownerEphemeral,
  possession,
  recipient,
  recipientKeyFingerprint,
  recipientKeyVersion,
  serverEphemeral,
  syntheticMeta,
  timestamps,
}) {
  return {
    meta: {
      ...syntheticMeta,
      warning:
        "Private scalars exist only for deterministic reference testing. Native custody tests must generate a hardware key and must never import these values.",
    },
    protocol: PROTOCOL,
    profile: "registered_recipient_v2",
    algorithms: {
      key_agreement: "p256_ecdh",
      public_key_encoding: "ansi_x9_63_uncompressed",
      kdf: "hkdf_sha256",
      possession_proof: "hmac_sha256",
      aead: "xchacha20poly1305_ietf",
    },
    synthetic_key_material: {
      recipient_private_scalar: base64url(recipient.privateKey),
      recipient_public_key: base64url(recipient.publicKey),
      server_ephemeral_private_scalar: base64url(serverEphemeral.privateKey),
      owner_ephemeral_private_scalar: base64url(ownerEphemeral.privateKey),
    },
    recipient_key: {
      key_id: ids.recipientKeyV2,
      key_version: recipientKeyVersion,
      public_key: base64url(recipient.publicKey),
      fingerprint: base64url(recipientKeyFingerprint),
    },
    possession: {
      challenge: possession.challenge,
      canonical_challenge: base64url(possession.canonical),
      salt: base64url(possession.salt),
      expected_mac: base64url(possession.mac),
    },
    grant: {
      plaintext: grant.plaintext,
      canonical_plaintext: base64url(grant.canonicalPlaintext),
      associated_data: grant.associatedData,
      canonical_associated_data: base64url(grant.canonicalAssociatedData),
      wrap_salt: base64url(grant.salt),
      nonce: base64url(grant.nonce),
      expected_wrap_key: base64url(grant.wrapKey),
      expected_ciphertext: base64url(grant.ciphertext),
      envelope: {
        protocol: PROTOCOL,
        profile: "registered_recipient_v2",
        key_agreement: "p256_ecdh",
        kdf: "hkdf_sha256",
        aead: "xchacha20poly1305_ietf",
        grant_id: ids.grantV2,
        recipient_id: ids.recipient,
        recipient_key_id: ids.recipientKeyV2,
        recipient_key_version: recipientKeyVersion,
        owner_ephemeral_public_key: base64url(ownerEphemeral.publicKey),
        nonce: base64url(grant.nonce),
        ciphertext: base64url(grant.ciphertext),
        created_at: timestamps.created,
        grant_version: 2,
        revoked_at: null,
      },
    },
    negative_cases: [
      "wrong_recipient_private_key",
      "changed_challenge_binding",
      "changed_origin_binding",
      "changed_recipient_key_version",
      "changed_owner_binding",
      "changed_ephemeral_public_key",
      "changed_associated_data",
      "changed_ciphertext",
      "unsupported_protocol_version",
    ],
  };
}

function deterministicP256Key(lastByte) {
  const privateKey = new Uint8Array(32);
  privateKey[31] = lastByte;
  const instance = createECDH("prime256v1");
  instance.setPrivateKey(privateKey);
  return {
    privateKey,
    publicKey: new Uint8Array(instance.getPublicKey(undefined, "uncompressed")),
  };
}

function ecdh(privateKey, peerPublicKey) {
  const instance = createECDH("prime256v1");
  instance.setPrivateKey(privateKey);
  return new Uint8Array(instance.computeSecret(peerPublicKey));
}

function hkdfSha256(inputKeyMaterial, salt, info, outputLength) {
  const pseudorandomKey = hmacSha256(salt, inputKeyMaterial);
  let previous = new Uint8Array();
  let output = new Uint8Array();
  for (let counter = 1; output.length < outputLength; counter += 1) {
    previous = hmacSha256(
      pseudorandomKey,
      concat(previous, info, Uint8Array.of(counter)),
    );
    output = concat(output, previous);
  }
  return output.slice(0, outputLength);
}

function sha256(value) {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

function hmacSha256(key, value) {
  return new Uint8Array(createHmac("sha256", key).update(value).digest());
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function bytesFromRange(start, length) {
  return Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);
}

function concat(...values) {
  const result = new Uint8Array(
    values.reduce((total, value) => total + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}
