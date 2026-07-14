import { useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import * as ExpoSecureStore from "expo-secure-store";

import {
  ErrorText,
  Field,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import { createProfileBasics, type ProfileBasicsFormValues } from "../profile-basics-form";
import {
  createProfileBasicsViewModel,
  type ProfileBasicsFormField,
} from "../profile-basics-view-model";
import { createSignupProgressStorage } from "../signup-progress";

type ProfileBasicsPanelProps = {
  email: string;
};

const initialValues = {
  country: "",
  firstName: "",
  nationality: "",
};

type ProfileBasicsValues = ProfileBasicsFormValues;

export function ProfileBasicsPanel({ email }: ProfileBasicsPanelProps) {
  const viewModel = createProfileBasicsViewModel();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <StepHeader step="account-3" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <ProfileBasicsFields
        fields={viewModel.fields}
        onChange={(fieldName, text) => {
          setValues((current) => ({ ...current, [fieldName]: text }));
          setError(null);
        }}
        values={values}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Working..." : viewModel.primaryActionLabel}
          onPress={() =>
            submitProfileBasics({
              email,
              onError: setError,
              onSubmittingChange: setIsSubmitting,
              router,
              values,
            })
          }
        />
      </View>
    </View>
  );
}

function ProfileBasicsFields({
  fields,
  onChange,
  values,
}: {
  fields: ProfileBasicsFormField[];
  onChange: (fieldName: keyof ProfileBasicsValues, text: string) => void;
  values: ProfileBasicsValues;
}) {
  return (
    <View style={{ gap: 14 }}>
      {fields.map((field) => (
        <Field
          autoCapitalize="words"
          key={field.name}
          label={field.label}
          onChangeText={(text) => onChange(field.name, text)}
          value={values[field.name]}
        />
      ))}
    </View>
  );
}

async function submitProfileBasics({
  email,
  onError,
  onSubmittingChange,
  router,
  values,
}: {
  email: string;
  onError: (error: string | null) => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
  router: ReturnType<typeof useRouter>;
  values: ProfileBasicsValues;
}) {
  onSubmittingChange(true);

  try {
    createProfileBasics(values);
    const progressStorage = createSignupProgressStorage(ExpoSecureStore);
    await progressStorage.save({ email, step: "setup-totp" });
    router.push({
      pathname: "/auth/setup-totp",
      params: { email },
    });
  } catch (caughtError) {
    onError(
      caughtError instanceof Error ? caughtError.message : "Please fill in all fields.",
    );
  } finally {
    onSubmittingChange(false);
  }
}
