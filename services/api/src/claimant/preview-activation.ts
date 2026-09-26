/**
 * Staging wiring W1: the only way a claimant route opens on a hosted deployment. It is true only on the Vercel
 * Preview build of the single `claimant-preview` branch with the synthetic-only activation set. Production, local
 * runs and every other preview stay closed. The production approval constants remain literal false.
 */
export const CLAIMANT_PREVIEW_BRANCH = "claimant-preview" as const;
export const CLAIMANT_PREVIEW_ACTIVATION_VALUE = "synthetic-only" as const;

type Env = Readonly<Record<string, string | undefined>>;

export function isClaimantPreviewActivated(env: Env = process.env): boolean {
  return env.VERCEL === "1"
    && env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === CLAIMANT_PREVIEW_BRANCH
    && env.CLAIMANT_PREVIEW_ACTIVATION === CLAIMANT_PREVIEW_ACTIVATION_VALUE;
}
