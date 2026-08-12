import { X509Certificate, timingSafeEqual } from "node:crypto";

import type { AppAttestCertificateTrustV1 } from "./app-attest-verifier.js";
import { assertValidP256PointV1 } from "./native-enrollment-verifier-contract.js";

const APP_ATTEST_NONCE_OID_DER = Buffer.from("2a864886f763640802", "hex");

export function createPinnedAppleAppAttestTrustV1(input: Readonly<{
  now?: () => Date;
  rootCertificateDer: Uint8Array;
}>): AppAttestCertificateTrustV1 {
  const rootDer = Buffer.from(input.rootCertificateDer);
  const pinnedRoot = parseCertificate(rootDer);
  if (!pinnedRoot.ca) fail();
  return {
    async verifyCertificateChain(request) {
      if (request.certificatesDer.length < 2 || request.certificatesDer.length > 4 || request.expectedNonce.byteLength !== 32) fail();
      const chain = request.certificatesDer.map((certificate) => parseCertificate(Buffer.from(certificate)));
      const now = (input.now ?? (() => new Date()))().getTime();
      for (const certificate of [...chain, pinnedRoot]) assertCertificateTime(certificate, now);
      if (chain[0]!.ca || chain.slice(1).some((certificate) => !certificate.ca)) fail();
      for (let index = 0; index < chain.length - 1; index += 1) {
        const certificate = chain[index]!; const issuer = chain[index + 1]!;
        if (!certificate.checkIssued(issuer) || !certificate.verify(issuer.publicKey)) fail();
      }
      const last = chain.at(-1)!;
      if (!last.checkIssued(pinnedRoot) || !last.verify(pinnedRoot.publicKey)) fail();
      const nonce = extractAppAttestNonceExtensionV1(chain[0]!.raw);
      if (!timingSafeEqual(nonce, request.expectedNonce)) fail();
      const jwk = chain[0]!.publicKey.export({ format: "jwk" });
      if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) fail();
      const point = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
      assertValidP256PointV1(point);
      return { leafPublicKeyX963: point };
    },
  };
}

export function extractAppAttestNonceExtensionV1(certificateDer: Uint8Array): Buffer {
  const source = Buffer.from(certificateDer);
  const certificate = readDer(source, 0);
  if (certificate.tag !== 0x30 || certificate.end !== certificateDer.byteLength) fail();
  const certificateChildren = readChildren(certificate, source);
  const tbs = certificateChildren[0];
  if (!tbs || tbs.tag !== 0x30) fail();
  const extensionsContainer = readChildren(tbs, source).find((item) => item.tag === 0xa3);
  if (!extensionsContainer) fail();
  const extensionsSequence = readChildren(extensionsContainer, source);
  if (extensionsSequence.length !== 1 || extensionsSequence[0]!.tag !== 0x30) fail();
  for (const extension of readChildren(extensionsSequence[0]!, source)) {
    if (extension.tag !== 0x30) fail();
    const fields = readChildren(extension, source);
    if (fields.length < 2 || fields.length > 3 || fields[0]!.tag !== 0x06) fail();
    if (!Buffer.from(certificateDer.slice(fields[0]!.contentStart, fields[0]!.end)).equals(APP_ATTEST_NONCE_OID_DER)) continue;
    const value = fields.at(-1)!;
    if (value.tag !== 0x04) fail();
    const wrapped = Buffer.from(certificateDer.slice(value.contentStart, value.end));
    const sequence = readDer(wrapped, 0);
    if (sequence.tag !== 0x30 || sequence.end !== wrapped.byteLength) fail();
    const sequenceChildren = readChildren(sequence, wrapped);
    if (sequenceChildren.length !== 1 || sequenceChildren[0]!.tag !== 0xa1) fail();
    const explicit = readChildren(sequenceChildren[0]!, wrapped);
    if (explicit.length !== 1 || explicit[0]!.tag !== 0x04) fail();
    const nonce = wrapped.subarray(explicit[0]!.contentStart, explicit[0]!.end);
    if (nonce.byteLength !== 32) fail();
    return nonce;
  }
  fail();
}

type DerItem = Readonly<{ contentStart: number; end: number; start: number; tag: number }>;

function readDer(source: Uint8Array, offset: number): DerItem {
  if (offset + 2 > source.byteLength) fail();
  const tag = source[offset]!; const firstLength = source[offset + 1]!;
  let length = 0; let contentStart = offset + 2;
  if ((firstLength & 0x80) === 0) length = firstLength;
  else {
    const lengthBytes = firstLength & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4 || contentStart + lengthBytes > source.byteLength || source[contentStart] === 0) fail();
    for (let index = 0; index < lengthBytes; index += 1) length = (length * 256) + source[contentStart + index]!;
    if (length < 128) fail();
    contentStart += lengthBytes;
  }
  const end = contentStart + length;
  if (end > source.byteLength) fail();
  return { contentStart, end, start: offset, tag };
}

function readChildren(item: DerItem, source: Uint8Array): DerItem[] {
  const bytes = source;
  const children: DerItem[] = []; let offset = item.contentStart;
  while (offset < item.end) { const child = readDer(bytes, offset); if (child.end > item.end) fail(); children.push(child); offset = child.end; }
  if (offset !== item.end) fail();
  return children;
}

function parseCertificate(der: Buffer): X509Certificate {
  if (der.byteLength === 0 || der.byteLength > 8_192) fail();
  try { return new X509Certificate(der); } catch { fail(); }
}

function assertCertificateTime(certificate: X509Certificate, now: number) {
  if (now < certificate.validFromDate.getTime() || now > certificate.validToDate.getTime()) fail();
}

function fail(): never { throw new Error("App Attest certificate trust failed."); }
