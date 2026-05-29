export type ContactFormField =
  | {
      label: string;
      name: "name" | "phone" | "email" | "country" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "relationship";
      options: { label: string; value: "lawyer" | "accountant" | "employer" | "embassy" | "other" }[];
      type: "select";
    };

export type ContactFormViewModel = {
  fields: ContactFormField[];
};

export function createContactFormViewModel(): ContactFormViewModel {
  return {
    fields: [
      { label: "Name", name: "name", required: true, type: "text" },
      {
        label: "Relationship",
        name: "relationship",
        options: [
          { label: "Lawyer", value: "lawyer" },
          { label: "Accountant", value: "accountant" },
          { label: "Employer HR", value: "employer" },
          { label: "Embassy", value: "embassy" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      { label: "Phone", name: "phone", required: false, type: "text" },
      { label: "Email", name: "email", required: false, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
