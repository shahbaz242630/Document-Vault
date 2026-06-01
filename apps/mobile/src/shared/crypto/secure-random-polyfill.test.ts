import { describe, expect, it, vi } from "vitest";

import { installSecureRandomPolyfill } from "./secure-random-polyfill";

describe("installSecureRandomPolyfill", () => {
  it("adds getRandomValues without replacing an existing crypto object", () => {
    const target = { crypto: { subtle: {} } };
    const getRandomValues = vi.fn((array: Uint8Array) => {
      array.fill(7);
      return array;
    });

    installSecureRandomPolyfill({
      getRandomValues: getRandomValues as <T extends ArrayBufferView>(array: T) => T,
      target: target as unknown as typeof globalThis,
    });

    const random = new Uint8Array(2);
    const crypto = target.crypto as typeof target.crypto & {
      getRandomValues: (array: Uint8Array) => Uint8Array;
    };

    expect(crypto.subtle).toEqual({});
    expect(crypto.getRandomValues(random)).toBe(random);
    expect([...random]).toEqual([7, 7]);
  });

  it("keeps an existing getRandomValues implementation", () => {
    const existing = vi.fn((array: Uint8Array) => array);
    const replacement = vi.fn((array: Uint8Array) => array);
    const target = { crypto: { getRandomValues: existing } };

    installSecureRandomPolyfill({
      getRandomValues: replacement as <T extends ArrayBufferView>(array: T) => T,
      target: target as unknown as typeof globalThis,
    });

    const random = new Uint8Array(1);
    target.crypto.getRandomValues(random);

    expect(existing).toHaveBeenCalledWith(random);
    expect(replacement).not.toHaveBeenCalled();
  });
});
