import { isIP } from "node:net";

import type { Context } from "hono";

import type { OfflineCodeV2TrustedSignals } from "./offline-code-v2-controller.js";

/**
 * Staging wiring W1: the offline-code V2 network signal on Vercel. Vercel's edge sets x-vercel-forwarded-for to
 * the connecting client's address and overwrites any value a client sends, so it is the only header read. Off
 * Vercel there is no trusted edge, and the controller keeps refusing with 503. The address only ever leaves this
 * function as the keyed rate-limit digest the controller derives.
 */
const VERCEL_CLIENT_ADDRESS_HEADER = "x-vercel-forwarded-for";

type Env = Readonly<Record<string, string | undefined>>;

export function createVercelTrustedSignals(env: Env = process.env) {
  return async (context: Context): Promise<OfflineCodeV2TrustedSignals | null> => {
    if (env.VERCEL !== "1") return null;
    const address = context.req.header(VERCEL_CLIENT_ADDRESS_HEADER)?.trim();
    if (!address || address.length > 45 || isIP(address) === 0) return null;
    return { networkSignal: address };
  };
}
