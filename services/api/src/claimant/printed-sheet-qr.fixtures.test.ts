import createQrCode from "qrcode-generator";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

/*
 * Slice 6I: reads the QR code back out of a printed emergency sheet, as a camera would. The sheet HTML carries the
 * QR as the SVG that `qrcode-generator` emits: a white background and one path of dark squares, each written as
 * `Mx,yl{c},0 0,{c} -{c},0 0,-{c}z`. The squares are drawn into a greyscale bitmap with a quiet zone and handed
 * to an independent decoder, so a test proves the printed image decodes rather than trusting the encoder.
 */
export function decodePrintedSheetQr(html: string): string {
  const svg = /<div class="qr">(<svg[^]*?<\/svg>)<\/div>/u.exec(html)?.[1];
  if (!svg) throw new Error("The printed sheet has no QR code.");
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/u.exec(svg);
  const path = /<path d="([^"]+)"/u.exec(svg)?.[1];
  if (!viewBox || viewBox[1] !== viewBox[2] || !path) throw new Error("The printed QR code is not in the expected form.");
  const size = Number(viewBox[1]);
  const scale = 4;
  const width = size * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  const square = /M(\d+),(\d+)l(\d+),0 0,\3 -\3,0 0,-\3z/gu;
  let squares = 0;
  for (const [, x, y, cell] of path.matchAll(square)) {
    squares += 1;
    for (let row = Number(y) * scale; row < (Number(y) + Number(cell)) * scale; row += 1)
      for (let column = Number(x) * scale; column < (Number(x) + Number(cell)) * scale; column += 1)
        pixels.fill(0, (row * width + column) * 4, (row * width + column) * 4 + 3);
  }
  if (squares === 0 || path.replace(square, "").trim() !== "") throw new Error("The printed QR path was not fully read.");
  const decoded = jsQR(pixels, width, width, { inversionAttempts: "dontInvert" });
  if (!decoded) throw new Error("The printed QR code could not be decoded.");
  return decoded.data;
}

function sheetHtml(text: string) {
  const code = createQrCode(0, "M");
  code.addData(text, "Byte");
  code.make();
  return `<div class="qr">${code.createSvgTag({ cellSize: 4, margin: 4, scalable: true })}</div>`;
}

describe("printed sheet QR fixture", () => {
  it("decodes what the sheet renderer's QR library encodes", () => {
    const text = `SKQ2.${"eyJwcm90b2NvbCI6InNhbmR1cWtpbi1vZmZsaW5lLWNvZGUtdjIi".repeat(8)}`;
    expect(decodePrintedSheetQr(sheetHtml(text))).toBe(text);
  });

  it("fails rather than guessing when the QR code is missing or damaged", () => {
    expect(() => decodePrintedSheetQr("<p>no code</p>")).toThrow("no QR code");
    const html = sheetHtml("SKQ2.damaged");
    expect(() => decodePrintedSheetQr(html.replace(/M\d+,\d+l4,0 0,4 -4,0 0,-4z /gu, ""))).toThrow();
  });
});
