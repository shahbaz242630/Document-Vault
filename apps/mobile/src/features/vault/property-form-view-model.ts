export type PropertyFormField =
  | {
      helperText?: string;
      label: string;
      name: "title" | "address" | "country" | "mortgageProvider" | "documentLocation" | "contact" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "approximateValueRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type PropertyFormViewModel = {
  fields: PropertyFormField[];
};

export function createPropertyFormViewModel(): PropertyFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Address", name: "address", required: true, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      {
        label: "Approximate value",
        name: "approximateValueRange",
        options: [
          { label: "Under 50K", value: "under_50k" },
          { label: "50–200K", value: "50_200k" },
          { label: "200–500K", value: "200_500k" },
          { label: "500K–1M", value: "500k_1m" },
          { label: "Over 1M", value: "over_1m" },
          { label: "Prefer not to say", value: "prefer_not_to_say" },
        ],
        type: "select",
      },
      { label: "Mortgage provider", name: "mortgageProvider", required: false, type: "text" },
      { label: "Document location", name: "documentLocation", required: false, type: "text" },
      { label: "Contact", name: "contact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
