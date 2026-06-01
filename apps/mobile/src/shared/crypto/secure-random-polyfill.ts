type CryptoWithRandomValues = Crypto & {
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

type InstallSecureRandomPolyfillOptions = {
  getRandomValues: <T extends ArrayBufferView>(array: T) => T;
  target?: typeof globalThis;
};

export function installSecureRandomPolyfill({
  getRandomValues: randomValues,
  target = globalThis,
}: InstallSecureRandomPolyfillOptions): void {
  const existingCrypto = target.crypto as CryptoWithRandomValues | undefined;

  if (existingCrypto?.getRandomValues) {
    return;
  }

  Object.defineProperty(target, "crypto", {
    configurable: true,
    value: {
      ...(existingCrypto ?? {}),
      getRandomValues: randomValues,
    },
  });
}
