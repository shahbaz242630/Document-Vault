export type SubscriptionFormField =
  | {
      helperText?: string;
      label: string;
      name: "title" | "serviceName" | "country" | "documentLocation" | "subscriptionContact" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "subscriptionType";
      options: { label: string; value: "streaming" | "software" | "utility" | "other" }[];
      type: "select";
    }
  | {
      label: string;
      name: "approximateCostRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type SubscriptionFormViewModel = {
  fields: SubscriptionFormField[];
};

export function createSubscriptionFormViewModel(): SubscriptionFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Service name", name: "serviceName", required: true, type: "text" },
      {
        label: "Subscription type",
        name: "subscriptionType",
        options: [
          { label: "Streaming", value: "streaming" },
          { label: "Software", value: "software" },
          { label: "Utility", value: "utility" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      { label: "Country", name: "country", required: true, type: "text" },
      {
        label: "Approximate monthly cost",
        name: "approximateCostRange",
        options: [
          { label: "Under 50", value: "under_50" },
          { label: "50–200", value: "50_200" },
          { label: "200–500", value: "200_500" },
          { label: "Over 500", value: "over_500" },
          { label: "Prefer not to say", value: "prefer_not_to_say" },
        ],
        type: "select",
      },
      { label: "Document location", name: "documentLocation", required: false, type: "text" },
      { label: "Contact", name: "subscriptionContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
