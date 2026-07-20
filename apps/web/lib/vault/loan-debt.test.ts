import { describe, expect, it } from "vitest";

import { createWebLoanDebtPayload } from "./loan-debt";

describe("createWebLoanDebtPayload", () => {
  it("matches the complete mobile loan/debt field contract", () => {
    expect(createWebLoanDebtPayload({
      contact: "Relationship manager",
      country: "UAE",
      debtType: "Mortgage",
      lastFourDigits: "REF-1234",
      lenderName: "Example Lender",
      notes: "Paid monthly",
      title: "Home loan",
    })).toEqual({
      assetType: "loan_debt",
      fields: {
        contact: "Relationship manager",
        country: "UAE",
        debtType: "Mortgage",
        lastFourDigits: "REF-1234",
        lenderName: "Example Lender",
      },
      notes: "Paid monthly",
      title: "Home loan",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebLoanDebtPayload({
      contact: "",
      country: "UAE",
      debtType: "Mortgage",
      lastFourDigits: "",
      lenderName: "Example Lender",
      notes: "",
      title: "Home loan",
    }, {
      contact: "Old contact",
      futureMobileField: "must survive",
      lastFourDigits: "OLD-1234",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.contact).toBeUndefined();
    expect(payload.fields.lastFourDigits).toBeUndefined();
  });

  it("rejects an incomplete loan/debt record", () => {
    expect(() => createWebLoanDebtPayload({
      country: "UAE",
      debtType: "Mortgage",
      lenderName: "",
      title: "Home loan",
    })).toThrow();
  });
});
