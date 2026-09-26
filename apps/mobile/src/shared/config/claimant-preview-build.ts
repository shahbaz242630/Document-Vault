import { readClaimantPreviewAppMarker } from "./claimant-preview-marker";

/*
 * Staging wiring W2a: the only way a claimant screen opens in an app build. Both build-time signals must agree:
 * the inlined public switch, which app.config.js refuses outside the claimant_preview target, and that target's
 * own marker in the embedded app config. The real app has neither, so every claimant gate stays closed there.
 */
export const CLAIMANT_PREVIEW_BUILD_VALUE = "synthetic-only" as const;

type PreviewSignals = Readonly<{ flag: string | undefined; extra: Readonly<Record<string, unknown>> | undefined }>;

export function isClaimantPreviewBuild(signals: PreviewSignals = {
  // Literal read so Expo inlines the public build-time value.
  flag: process.env.EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD,
  extra: readClaimantPreviewAppMarker(),
}): boolean {
  return signals.flag === CLAIMANT_PREVIEW_BUILD_VALUE && signals.extra?.claimantPreviewBuild === true;
}
