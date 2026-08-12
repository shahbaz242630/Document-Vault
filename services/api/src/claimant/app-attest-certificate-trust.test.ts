import { describe, expect, it } from "vitest";

import { extractAppAttestNonceExtensionV1 } from "./app-attest-certificate-trust.js";

describe("App Attest certificate nonce extension", () => {
  it("extracts only the exact Apple nonce OID ASN.1 shape", () => {
    const nonce = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
    const oid = der(0x06, Buffer.from("2a864886f763640802", "hex"));
    const wrappedNonce = der(0x30, der(0xa1, der(0x04, nonce)));
    const extension = der(0x30, Buffer.concat([oid, der(0x04, wrappedNonce)]));
    const extensions = der(0xa3, der(0x30, extension));
    const certificate = der(0x30, der(0x30, extensions));
    expect(extractAppAttestNonceExtensionV1(certificate)).toEqual(nonce);
  });

  it("rejects a wrong OID and a nonce with the wrong length", () => {
    const certificate = (oid: Buffer, nonce: Buffer) => der(0x30, der(0x30,
      der(0xa3, der(0x30, der(0x30, Buffer.concat([
        der(0x06, oid), der(0x04, der(0x30, der(0xa1, der(0x04, nonce)))),
      ]))))));
    expect(() => extractAppAttestNonceExtensionV1(certificate(Buffer.from([0x2a, 0x03]), Buffer.alloc(32))))
      .toThrow("certificate trust failed");
    expect(() => extractAppAttestNonceExtensionV1(certificate(Buffer.from("2a864886f763640802", "hex"), Buffer.alloc(31))))
      .toThrow("certificate trust failed");
  });
});

function der(tag: number, contents: Uint8Array): Buffer {
  if (contents.byteLength < 128) return Buffer.concat([Buffer.from([tag, contents.byteLength]), contents]);
  if (contents.byteLength <= 0xff) return Buffer.concat([Buffer.from([tag, 0x81, contents.byteLength]), contents]);
  const length = Buffer.alloc(2); length.writeUInt16BE(contents.byteLength);
  return Buffer.concat([Buffer.from([tag, 0x82]), length, contents]);
}
