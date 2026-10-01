import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { createTotpQrMatrix, formatTotpSetupKey } from "./totp-qr-matrix";
import {
  createTotpEnrollmentViewModel,
  totpEnrollmentNextRoute,
} from "./totp-enrollment-view-model";

const uri = "otpauth://totp/Sanduqkin:partner%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Sanduqkin";

/** Paints the matrix as the panel does (black runs on white, four-module quiet zone) and decodes it. */
function decode(matrix: ReturnType<typeof createTotpQrMatrix>): string | null {
  const scale = 4;
  const side = (matrix.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  matrix.rows.forEach((runs, row) => {
    for (const run of runs) {
      for (let column = run.start; column < run.start + run.length; column += 1) {
        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            const offset = (((row + 4) * scale + y) * side + (column + 4) * scale + x) * 4;
            pixels.fill(0, offset, offset + 3);
          }
        }
      }
    }
  });
  return jsQR(pixels, side, side)?.data ?? null;
}

describe("TOTP enrolment QR code", () => {
  it("decodes back to the exact otpauth URI", () => {
    const matrix = createTotpQrMatrix(uri);
    expect(matrix.rows).toHaveLength(matrix.size);
    expect(decode(matrix)).toBe(uri);
  });

  it("groups the setup key in fours for typing by hand", () => {
    expect(formatTotpSetupKey("JBSWY3DPEHPK3PXPJB")).toBe("JBSW Y3DP EHPK 3PXP JB");
  });
});

describe("TOTP enrolment routes", () => {
  it("sends sign-up to backup codes and an existing account straight to proving the code", () => {
    expect(totpEnrollmentNextRoute("onboarding", "factor-1"))
      .toEqual({ params: { factorId: "factor-1" }, pathname: "/auth/backup-codes" });
    expect(totpEnrollmentNextRoute("sign-in", "factor-1"))
      .toEqual({ params: { factorId: "factor-1", flow: "enrollment" }, pathname: "/auth/verify-totp" });
    expect(createTotpEnrollmentViewModel("sign-in").body).toContain("needs a second lock before your vault opens");
  });
});
