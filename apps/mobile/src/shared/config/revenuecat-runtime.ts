type RevenueCatRuntimeInput = {
  appOwnership: string | null;
  platform: string;
};

export function shouldUseRevenueCatNativeBridge({
  appOwnership,
  platform,
}: RevenueCatRuntimeInput): boolean {
  return platform !== "web" && appOwnership !== "expo";
}
