import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  formatDynamicAssetFormError,
  getMissingRequiredFieldError,
} from "./dynamic-asset-form-validation";

const fields = [
  { label: "Name", name: "name", required: true },
  { label: "Country", name: "country", required: true },
  { label: "Notes", name: "notes", required: false },
];

describe("dynamic asset form validation", () => {
  it("names the first missing required field before save", () => {
    expect(
      getMissingRequiredFieldError(fields, {
        country: "",
        name: "BUILD 4 QA RECORD",
        notes: "Synthetic",
      }),
    ).toBe("Country is required.");
  });

  it("does not block complete required fields", () => {
    expect(
      getMissingRequiredFieldError(fields, {
        country: "UAE",
        name: "BUILD 4 QA RECORD",
        notes: "",
      }),
    ).toBeNull();
  });

  it("turns Zod required-field details into reader-facing copy", () => {
    const schema = z.object({
      country: z.string().trim().min(1),
      name: z.string().trim().min(1),
    });

    try {
      schema.parse({ country: "", name: "BUILD 4 QA RECORD" });
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(formatDynamicAssetFormError(error, fields)).toBe(
        "Country is required.",
      );
    }
  });
});
