import { describe, expect, it } from "vitest";

import { createCryptoAssetPayload } from "./crypto-form";

describe("createCryptoAssetPayload", () => {
  it("builds a crypto asset payload from valid form values", () => {
    const payload = createCryptoAssetPayload({
      approximateValueRange: "under_50k",
      country: "UAE",
      cryptoType: "bitcoin",
      documentLocation: "Hardware wallet in safe",
      exchangeName: "Example Exchange",
      notes: "Seed phrase in safety deposit box.",
      title: "Bitcoin wallet",
      walletIdentifier: "a1b2",
    });

    expect(payload).toEqual({
      assetType: "crypto",
      fields: {
        approximateValueRange: "under_50k",
        country: "UAE",
        cryptoType: "bitcoin",
        documentLocation: "Hardware wallet in safe",
        exchangeName: "Example Exchange",
        walletIdentifier: "a1b2",
      },
      notes: "Seed phrase in safety deposit box.",
      title: "Bitcoin wallet",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createCryptoAssetPayload({
      approximateValueRange: "prefer_not_to_say",
      country: " UAE ",
      cryptoType: "bitcoin",
      documentLocation: " ",
      exchangeName: "",
      notes: " ",
      title: " Bitcoin wallet ",
      walletIdentifier: " a1b2 ",
    });

    expect(payload).toEqual({
      assetType: "crypto",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        cryptoType: "bitcoin",
        walletIdentifier: "a1b2",
      },
      title: "Bitcoin wallet",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createCryptoAssetPayload({
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        cryptoType: "bitcoin",
        title: "Bitcoin wallet",
        walletIdentifier: "",
      }),
    ).toThrow();
  });
});
