import { describe, expect, it } from "vitest";

import { createWebCryptoPayload } from "./crypto-reference";

describe("createWebCryptoPayload", () => {
  it("matches the complete mobile crypto-reference field contract", () => {
    expect(createWebCryptoPayload({
      approximateValueRange: "under_50k",
      country: "UAE",
      cryptoType: "bitcoin",
      documentLocation: "Hardware wallet in safe",
      exchangeName: "Example Exchange",
      notes: "Recovery material is in a safety deposit box",
      title: "Bitcoin wallet",
      walletIdentifier: "BTC cold",
    })).toEqual({
      assetType: "crypto",
      fields: {
        approximateValueRange: "under_50k",
        country: "UAE",
        cryptoType: "bitcoin",
        documentLocation: "Hardware wallet in safe",
        exchangeName: "Example Exchange",
        walletIdentifier: "BTC cold",
      },
      notes: "Recovery material is in a safety deposit box",
      title: "Bitcoin wallet",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebCryptoPayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      cryptoType: "ethereum",
      documentLocation: "",
      exchangeName: "",
      notes: "",
      title: "Updated wallet",
      walletIdentifier: "9EE7",
    }, {
      exchangeName: "Old exchange",
      futureMobileField: "must survive",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.exchangeName).toBeUndefined();
    expect(payload.fields.documentLocation).toBeUndefined();
  });

  it("rejects complete wallet addresses", () => {
    expect(() => createWebCryptoPayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      cryptoType: "ethereum",
      title: "Ethereum wallet",
      walletIdentifier: "0x52908400098527886E0F7030069857D2E4169EE7",
    })).toThrow("Enter a short label or only the last 4 wallet characters, not a complete address.");
  });
});
