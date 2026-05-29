export type OtherFormField = {
  label: string;
  name: "title" | "description" | "category" | "country" | "approximateValue" | "documentLocation" | "notes";
  required: boolean;
  type: "text";
};

export type OtherFormViewModel = {
  fields: OtherFormField[];
};

export function createOtherFormViewModel(): OtherFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Description", name: "description", required: false, type: "text" },
      { label: "Category or tag", name: "category", required: false, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Approximate value", name: "approximateValue", required: false, type: "text" },
      { label: "Where is the document kept?", name: "documentLocation", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
