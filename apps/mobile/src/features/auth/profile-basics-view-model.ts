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
    body: "This helps us suggest the right templates and keeps your vault organized.",
    fields: [
      { label: "First name", name: "firstName", required: true },
      { label: "Country of residence", name: "country", required: true },
      { label: "Nationality", name: "nationality", required: true },
    ],
    primaryActionLabel: "Continue",
    statusLabel: "Your profile",
    title: "A little about you",
  };
}
