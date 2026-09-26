/** W2a: outside iOS and Android (tests, web) there is no Preview app, so there is no marker. */
export function readClaimantPreviewAppMarker(): Readonly<Record<string, unknown>> | undefined {
  return undefined;
}
