import { createHmac, timingSafeEqual } from "node:crypto";

const ADDRESS_INDEX_LABEL_V1 = "sanduqkin:claim:invitation-address:v1";
const ASCII_DOT_ATOM = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/u;
const DNS_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/u;

export function normalizeInvitationAddressV1(input: string): string {
  const address = input.replace(/^[\x20\x09]+|[\x20\x09]+$/gu, "");
  if (address.length < 3 || address.length > 254 || /[^\x21-\x7e]/u.test(address)) {
    throw new Error("Invitation address is invalid.");
  }

  const separator = address.indexOf("@");
  if (separator < 1 || separator !== address.lastIndexOf("@")) {
    throw new Error("Invitation address is invalid.");
  }

  const localPart = address.slice(0, separator);
  const domainPart = address.slice(separator + 1);
  if (localPart.length > 64 || domainPart.length < 1 || domainPart.length > 253 ||
      !ASCII_DOT_ATOM.test(localPart)) {
    throw new Error("Invitation address is invalid.");
  }

  const domainLabels = domainPart.split(".");
  if (domainLabels.length < 2 || domainLabels.some((label) => !DNS_LABEL.test(label))) {
    throw new Error("Invitation address is invalid.");
  }

  return `${localPart}@${domainLabels.map((label) => label.toLowerCase()).join(".")}`;
}

export function deriveInvitationAddressIndexV1(
  addressIndexKey: Uint8Array,
  normalizedAddress: string,
): Uint8Array {
  if (addressIndexKey.byteLength !== 32 || normalizeInvitationAddressV1(normalizedAddress) !== normalizedAddress) {
    throw new Error("Invitation address index input is invalid.");
  }
  return new Uint8Array(createHmac("sha256", addressIndexKey)
    .update(ADDRESS_INDEX_LABEL_V1, "utf8")
    .update(Uint8Array.of(0))
    .update(normalizedAddress, "utf8")
    .digest());
}

export function invitationAddressRequiresExactCaseConfirmationV1(normalizedAddress: string): boolean {
  const normalized = normalizeInvitationAddressV1(normalizedAddress);
  const separator = normalized.indexOf("@");
  return /[A-Z]/u.test(normalized.slice(0, separator));
}

export function invitationAddressIndexesEqualV1(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === 32 && right.byteLength === 32 && timingSafeEqual(left, right);
}
