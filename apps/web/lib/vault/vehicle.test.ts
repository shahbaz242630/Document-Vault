import { describe, expect, it } from "vitest";

import { createWebVehiclePayload } from "./vehicle";

describe("createWebVehiclePayload", () => {
  it("matches the complete mobile vehicle field contract", () => {
    expect(createWebVehiclePayload({
      country: "UAE",
      documentLocation: "Home safe",
      makeModel: "Toyota Land Cruiser",
      notes: "Spare key with family",
      registrationPlate: "A 12345",
      title: "Family SUV",
      vehicleType: "SUV",
    })).toEqual({
      assetType: "vehicle",
      fields: {
        country: "UAE",
        documentLocation: "Home safe",
        makeModel: "Toyota Land Cruiser",
        registrationPlate: "A 12345",
        vehicleType: "SUV",
      },
      notes: "Spare key with family",
      title: "Family SUV",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebVehiclePayload({
      country: "UAE",
      documentLocation: "",
      makeModel: "Toyota Land Cruiser",
      notes: "",
      registrationPlate: "",
      title: "Family SUV",
      vehicleType: "SUV",
    }, {
      documentLocation: "Old safe",
      futureMobileField: "must survive",
      registrationPlate: "OLD 123",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.documentLocation).toBeUndefined();
    expect(payload.fields.registrationPlate).toBeUndefined();
  });

  it("rejects an incomplete vehicle", () => {
    expect(() => createWebVehiclePayload({
      country: "UAE",
      makeModel: "",
      title: "Family SUV",
      vehicleType: "SUV",
    })).toThrow();
  });
});
