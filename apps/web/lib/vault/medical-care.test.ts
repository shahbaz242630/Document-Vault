import { describe, expect, it } from "vitest";

import { createWebMedicalCarePayload } from "./medical-care";

describe("createWebMedicalCarePayload", () => {
  it("matches the complete mobile medical-care field contract", () => {
    expect(createWebMedicalCarePayload({
      conditions: "Penicillin allergy",
      doctorOrClinic: "Example Clinic",
      emergencyPreferences: "Contact family first",
      healthInsurance: "Example Health",
      medications: "Medication list location",
      notes: "Review annually",
      title: "Primary medical care",
    })).toEqual({
      assetType: "medical_care",
      fields: {
        conditions: "Penicillin allergy",
        doctorOrClinic: "Example Clinic",
        emergencyPreferences: "Contact family first",
        healthInsurance: "Example Health",
        medications: "Medication list location",
      },
      notes: "Review annually",
      title: "Primary medical care",
    });
  });

  it("preserves future fields while allowing every known optional field to be cleared", () => {
    const payload = createWebMedicalCarePayload({
      conditions: "",
      doctorOrClinic: "",
      emergencyPreferences: "",
      healthInsurance: "",
      medications: "",
      notes: "",
      title: "Primary medical care",
    }, {
      conditions: "Old condition",
      doctorOrClinic: "Old clinic",
      futureMobileField: "must survive",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.conditions).toBeUndefined();
    expect(payload.fields.doctorOrClinic).toBeUndefined();
  });

  it("rejects a missing title", () => {
    expect(() => createWebMedicalCarePayload({ title: "" })).toThrow();
  });
});
