import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createProfileBasics, type ProfileBasicsFormValues } from "../profile-basics-form";
import {
  createProfileBasicsViewModel,
  type ProfileBasicsFormField,
  type ProfileBasicsViewModel,
} from "../profile-basics-view-model";
import { createSignupProgressStorage } from "../signup-progress";
import * as ExpoSecureStore from "expo-secure-store";

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
    <View style={{ gap: 20 }}>
      <ProfileBasicsHeader viewModel={viewModel} />
      <ProfileBasicsFields
        fields={viewModel.fields}
        onChange={(fieldName, text) => {
          setValues((current) => ({ ...current, [fieldName]: text }));
          setError(null);
        }}
        values={values}
      />

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      <ProfileBasicsSubmitButton
        isSubmitting={isSubmitting}
        label={viewModel.primaryActionLabel}
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
  );
}

function ProfileBasicsHeader({ viewModel }: { viewModel: ProfileBasicsViewModel }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
        {viewModel.statusLabel}
      </Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
          lineHeight: 36,
        }}
      >
        {viewModel.title}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        {viewModel.body}
      </Text>
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
        <View key={field.name} style={{ gap: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
            {field.label}
          </Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(text) => onChange(field.name, text)}
            placeholder="Required"
            placeholderTextColor={colors.inkMuted}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: "continuous",
              borderRadius: 8,
              borderWidth: 1,
              color: colors.ink,
              fontSize: 17,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
            value={values[field.name]}
          />
        </View>
      ))}
    </View>
  );
}

function ProfileBasicsSubmitButton({
  isSubmitting,
  label,
  onPress,
}: {
  isSubmitting: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isSubmitting}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: isSubmitting ? colors.inkMuted : colors.action,
        borderCurve: "continuous",
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}
    >
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
        {isSubmitting ? "Working..." : label}
      </Text>
    </Pressable>
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
