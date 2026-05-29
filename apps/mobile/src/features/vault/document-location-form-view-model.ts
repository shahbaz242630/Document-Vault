export type DocumentLocationFormField =
  | {
      label: string;
      name: "title" | "location" | "country" | "custodian" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "documentType";
      options: { label: string; value: "will" | "deed" | "passport" | "other" }[];
      type: "select";
    };

export type DocumentLocationFormViewModel = {
  fields: DocumentLocationFormField[];
};

export function createDocumentLocationFormViewModel(): DocumentLocationFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      {
        label: "Document type",
        name: "documentType",
        options: [
          { label: "Will", value: "will" },
          { label: "Deed", value: "deed" },
          { label: "Passport", value: "passport" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      { label: "Where is it kept?", name: "location", required: true, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Who has custody?", name: "custodian", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
