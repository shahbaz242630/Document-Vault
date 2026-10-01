import { createQrMatrix, type QrMatrix } from "@/shared/qr/qr-matrix";

export type TotpQrMatrix = QrMatrix;

/** The enrolment QR code for the otpauth URI, drawn on the device. */
export function createTotpQrMatrix(otpauthUri: string): TotpQrMatrix {
  return createQrMatrix(otpauthUri);
}

/** The setup key in groups of four, for typing into an authenticator by hand. */
export function formatTotpSetupKey(secret: string): string {
  return secret.replace(/\s+/gu, "").match(/.{1,4}/gu)?.join(" ") ?? "";
}
