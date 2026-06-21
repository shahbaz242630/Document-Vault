import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";

export function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.trim().match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export function timingSafeStringEqual(actual: string | undefined, expected: string): boolean {
  if (!actual) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isRequestBodyTooLarge(context: Context, maxBytes: number): boolean {
  const contentLength = context.req.header("Content-Length")?.trim();

  if (!contentLength) {
    return false;
  }

  const byteLength = Number(contentLength);

  return Number.isFinite(byteLength) && byteLength > maxBytes;
}

