export type ProfileBasicsFormField = {
  label: string;
  name: "firstName" | "country" | "nationality";
  required: boolean;
};

export type ProfileBasicsViewModel = {
  body: string;
  fields: ProfileBasicsFormField[];
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
};

export function createProfileBasicsViewModel(): ProfileBasicsViewModel {
  return {
    body: "Just the essentials — so your kin know whose vault this is. Nothing here is shared or public.",
    fields: [
      { label: "First name", name: "firstName", required: true },
      { label: "Country of residence", name: "country", required: true },
      { label: "Nationality", name: "nationality", required: true },
    ],
    primaryActionLabel: "Continue",
    statusLabel: "Account · Step 3 of 3",
    title: "A few basics",
  };
}
