export type VaultCryptoBackend = "sodium-wasm" | "native";

type VaultCryptoRuntimeSupportInput = {
  backend: VaultCryptoBackend;
  hasWebAssembly?: boolean;
};

const UNSUPPORTED_SODIUM_WASM_MESSAGE =
  "Vault crypto backend sodium-wasm requires WebAssembly. Use a development build with a native vault crypto backend before running encrypted vault flows on React Native.";

export function isVaultCryptoRuntimeSupported({
  backend,
  hasWebAssembly = typeof WebAssembly !== "undefined",
}: VaultCryptoRuntimeSupportInput): boolean {
  if (backend === "native") {
    return true;
  }

  return hasWebAssembly;
}

export function assertVaultCryptoRuntimeSupported(
  input: VaultCryptoRuntimeSupportInput = { backend: "sodium-wasm" },
): void {
  if (isVaultCryptoRuntimeSupported(input)) {
    return;
  }

  throw new Error(UNSUPPORTED_SODIUM_WASM_MESSAGE);
}
