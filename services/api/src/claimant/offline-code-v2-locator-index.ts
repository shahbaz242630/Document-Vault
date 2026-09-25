import { createHmac } from "node:crypto";

/*
 * The single server-keyed boundary digest for offline-code V2. Owner registration (6G) and claimant challenge
 * lookup (5G) must derive the locator index identically, or a registered sheet can never be found.
 */
export type OfflineCodeV2BoundaryScope = "locator" | "network" | "device" | "global";

export function offlineCodeV2BoundaryDigest(key: Buffer, scope: OfflineCodeV2BoundaryScope,
  value: string): string {
  return createHmac("sha256", key).update("sanduqkin:claim:offline-code:v2:boundary")
    .update("\0").update(scope).update("\0").update(value).digest("base64url");
}
