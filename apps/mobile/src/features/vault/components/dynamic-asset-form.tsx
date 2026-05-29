import { useState } from "react";
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { colors } from "@/shared/theme/colors";

type SelectField = {
  label: string;
  name: string;
  options: { label: string; value: string }[];
  type: "select";
};

type TextField = {
  helperText?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  name: string;
  required: boolean;
  type: "text";
};

export type DynamicFormField = SelectField | TextField;

type DynamicAssetFormProps = {
  categoryLabel: string;
  fields: DynamicFormField[];
  initialValues: Record<string, string>;
  mode?: "add" | "edit";
  onSave?: (values: Record<string, string>) => Promise<void>;
};

export function DynamicAssetForm({
  categoryLabel,
  fields,
  initialValues,
  mode = "add",
  onSave,
}: DynamicAssetFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>{categoryLabel}</Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {mode === "add" ? "Add a reference" : "Edit reference"}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          Store only the information your family needs to find and contact the right place.
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        {fields.map((field) => (
          <View key={field.name} style={{ gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
              {field.label}
            </Text>
            {field.type === "select" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {field.options.map((option) => {
                  const isSelected = values[field.name] === option.value;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={option.value}
                      onPress={() => {
                        setValues((current) => ({
                          ...current,
                          [field.name]: option.value,
                        }));
                        setError(null);
                        setSavedTitle(null);
                      }}
                      style={{
                        backgroundColor: isSelected ? colors.action : colors.surface,
                        borderColor: isSelected ? colors.action : colors.border,
                        borderCurve: "continuous",
                        borderRadius: 8,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.actionText : colors.ink,
                          fontSize: 15,
                          fontWeight: "700",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <TextInput
                keyboardType={field.keyboardType}
                onChangeText={(text) => {
                  setValues((current) => ({ ...current, [field.name]: text }));
                  setError(null);
                  setSavedTitle(null);
                }}
                placeholder={field.required ? "Required" : "Optional"}
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
                value={values[field.name] ?? ""}
              />
            )}
            {field.type === "text" && field.helperText ? (
              <Text selectable style={{ color: colors.inkMuted, fontSize: 13 }}>
                {field.helperText}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15 }}>
          {error}
        </Text>
      ) : null}

      {savedTitle ? (
        <Text selectable style={{ color: colors.action, fontSize: 15 }}>
          {mode === "add" ? "Added locally: " : "Updated: "}
          {savedTitle}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={async () => {
          try {
            setIsSaving(true);
            await onSave?.(values);
            setSavedTitle(values.title ?? "Reference");
          } catch (caughtError) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "This reference could not be saved.",
            );
          } finally {
            setIsSaving(false);
          }
        }}
        style={{
          alignItems: "center",
          backgroundColor: isSaving ? colors.inkMuted : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {isSaving ? "Saving..." : mode === "add" ? "Save reference" : "Update reference"}
        </Text>
      </Pressable>
    </View>
  );
}
