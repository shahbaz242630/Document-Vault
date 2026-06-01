import { describe, expect, it } from "vitest";

import {
  assertVaultCryptoRuntimeSupported,
  isVaultCryptoRuntimeSupported,
} from "./vault-crypto-runtime";

describe("vault crypto runtime support", () => {
  it("supports the current sodium-wasm backend when WebAssembly is present", () => {
    expect(
      isVaultCryptoRuntimeSupported({
        backend: "sodium-wasm",
        hasWebAssembly: true,
      }),
    ).toBe(true);
  });

  it("rejects the current sodium-wasm backend when WebAssembly is absent", () => {
    expect(
      isVaultCryptoRuntimeSupported({
        backend: "sodium-wasm",
        hasWebAssembly: false,
      }),
    ).toBe(false);
  });

  it("supports the native backend without WebAssembly", () => {
    expect(
      isVaultCryptoRuntimeSupported({
        backend: "native",
        hasWebAssembly: false,
      }),
    ).toBe(true);
  });

  it("throws a clear migration error for unsupported runtimes", () => {
    expect(() =>
      assertVaultCryptoRuntimeSupported({
        backend: "sodium-wasm",
        hasWebAssembly: false,
      }),
    ).toThrow(
      "Vault crypto backend sodium-wasm requires WebAssembly. Use a development build with a native vault crypto backend before running encrypted vault flows on React Native.",
    );
  });
});
