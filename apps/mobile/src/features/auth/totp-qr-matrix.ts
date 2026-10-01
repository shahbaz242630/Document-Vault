import createQrCode from "qrcode-generator";

/** One dark run in a QR row: `start` and `length` are in modules, quiet zone excluded. */
export type QrRun = Readonly<{ length: number; start: number }>;

export type TotpQrMatrix = Readonly<{ rows: readonly (readonly QrRun[])[]; size: number }>;

/*
 * The enrolment QR code, drawn on the device from the otpauth URI so the setup key never leaves the app. Dark
 * modules are merged into runs per row to keep the native view count small.
 */
export function createTotpQrMatrix(otpauthUri: string): TotpQrMatrix {
  const code = createQrCode(0, "M");
  code.addData(otpauthUri, "Byte");
  code.make();
  const size = code.getModuleCount();
  const rows: QrRun[][] = [];

  for (let row = 0; row < size; row += 1) {
    const runs: QrRun[] = [];
    let start = -1;
    for (let column = 0; column <= size; column += 1) {
      const dark = column < size && code.isDark(row, column);
      if (dark && start < 0) start = column;
      if (!dark && start >= 0) {
        runs.push({ length: column - start, start });
        start = -1;
      }
    }
    rows.push(runs);
  }

  return { rows, size };
}

/** The setup key in groups of four, for typing into an authenticator by hand. */
export function formatTotpSetupKey(secret: string): string {
  return secret.replace(/\s+/gu, "").match(/.{1,4}/gu)?.join(" ") ?? "";
}
