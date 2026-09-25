import { createContext, useContext } from "react";

import type { ClaimFlowHandle } from "./claim-flow";

/** Supplied by the root layout; null whenever claimant claims are unavailable (always, in the current app). */
export const ClaimFlowHandleContext = createContext<ClaimFlowHandle | null>(null);

export function useClaimFlowHandle(): ClaimFlowHandle | null {
  return useContext(ClaimFlowHandleContext);
}
