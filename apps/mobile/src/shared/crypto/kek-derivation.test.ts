import { describe, expect, it } from "vitest";

import { deriveKEK, generateSalt } from "./kek-derivation";

describe("kek-derivation", () => {
  it("fails clearly when the sodium-wasm backend runs without WebAssembly", async () => {
    const webAssemblyDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "WebAssembly",
    );

    Object.defineProperty(globalThis, "WebAssembly", {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(generateSalt()).rejects.toThrow(
        "Vault crypto backend sodium-wasm requires WebAssembly.",
      );
    } finally {
      if (webAssemblyDescriptor) {
        Object.defineProperty(globalThis, "WebAssembly", webAssemblyDescriptor);
      }
    }
  });

  it("generateSalt produces 16-byte salt", async () => {
    const salt = await generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it("generateSalt produces different salts each call", async () => {
    const a = await generateSalt();
    const b = await generateSalt();
    expect(Buffer.from(a).toString("hex")).not.toBe(
      Buffer.from(b).toString("hex"),
    );
  });

  it("deriveKEK produces 32-byte key", async () => {
    const salt = await generateSalt();
    const kek = await deriveKEK("my-secure-password", salt);
    expect(kek).toBeInstanceOf(Uint8Array);
    expect(kek.length).toBe(32);
  });

  it("deriveKEK is deterministic for same password and salt", async () => {
    const salt = await generateSalt();
    const a = await deriveKEK("same-password", salt);
    const b = await deriveKEK("same-password", salt);
    expect(Buffer.from(a).toString("hex")).toBe(Buffer.from(b).toString("hex"));
  });

  it("deriveKEK produces different keys for different passwords with same salt", async () => {
    const salt = await generateSalt();
    const a = await deriveKEK("password-one", salt);
    const b = await deriveKEK("password-two", salt);
    expect(Buffer.from(a).toString("hex")).not.toBe(
      Buffer.from(b).toString("hex"),
    );
  });

  it("deriveKEK produces different keys for same password with different salts", async () => {
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    const a = await deriveKEK("same-password", saltA);
    const b = await deriveKEK("same-password", saltB);
    expect(Buffer.from(a).toString("hex")).not.toBe(
      Buffer.from(b).toString("hex"),
    );
  });

  it("deriveKEK rejects empty password", async () => {
    const salt = await generateSalt();
    await expect(deriveKEK("", salt)).rejects.toThrow(
      "Password cannot be empty.",
    );
  });

  it("deriveKEK rejects invalid salt length", async () => {
    await expect(
      deriveKEK("password", new Uint8Array(8)),
    ).rejects.toThrow("Invalid salt length");
  });
});
