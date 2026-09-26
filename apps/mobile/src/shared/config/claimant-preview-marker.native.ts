import Constants from "expo-constants";

/** W2a: the Preview app marker embedded by app.config.js; only native builds can carry it. */
export function readClaimantPreviewAppMarker(): Readonly<Record<string, unknown>> | undefined {
  return Constants.expoConfig?.extra;
}
