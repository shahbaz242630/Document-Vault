import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createProfileBasics } from "../profile-basics-form";
import { createProfileBasicsViewModel } from "../profile-basics-view-model";
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

export function ProfileBasicsPanel({ email }: ProfileBasicsPanelProps) {
  const viewModel = createProfileBasicsViewModel();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  return (
    <View style={{ gap: 20 }}>
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

      <View style={{ gap: 14 }}>
        {viewModel.fields.map((field) => (
          <View key={field.name} style={{ gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
              {field.label}
            </Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={(text) => {
                setValues((current) => ({ ...current, [field.name]: text }));
                setError(null);
              }}
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

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={async () => {
          setIsSubmitting(true);

          try {
            createProfileBasics(values);
            const progressStorage = createSignupProgressStorage(ExpoSecureStore);
            await progressStorage.save({ email, step: "setup-totp" });
            router.push({
              pathname: "/auth/setup-totp",
              params: { email },
            });
          } catch (caughtError) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Please fill in all fields.",
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
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
          {isSubmitting ? "Working..." : viewModel.primaryActionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
