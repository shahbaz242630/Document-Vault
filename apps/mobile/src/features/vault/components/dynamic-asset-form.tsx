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

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setError(null);
    setSavedTitle(null);
  };

  return (
    <View style={{ gap: 20 }}>
      <DynamicAssetFormHeader categoryLabel={categoryLabel} mode={mode} />
      <DynamicAssetFields fields={fields} onChange={updateValue} values={values} />
      <DynamicAssetFormMessage error={error} mode={mode} savedTitle={savedTitle} />
      <DynamicAssetSaveButton
        isSaving={isSaving}
        mode={mode}
        onSave={async () => {
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
      />
    </View>
  );
}

function DynamicAssetFormHeader({
  categoryLabel,
  mode,
}: {
  categoryLabel: string;
  mode: "add" | "edit";
}) {
  return (
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
  );
}

function DynamicAssetFields({
  fields,
  onChange,
  values,
}: {
  fields: DynamicFormField[];
  onChange: (name: string, value: string) => void;
  values: Record<string, string>;
}) {
  return (
    <View style={{ gap: 14 }}>
      {fields.map((field) => (
        <DynamicAssetField
          field={field}
          key={field.name}
          onChange={onChange}
          value={values[field.name] ?? ""}
        />
      ))}
    </View>
  );
}

function DynamicAssetField({
  field,
  onChange,
  value,
}: {
  field: DynamicFormField;
  onChange: (name: string, value: string) => void;
  value: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
        {field.label}
      </Text>
      {field.type === "select" ? (
        <DynamicSelectField field={field} onChange={onChange} value={value} />
      ) : (
        <DynamicTextField field={field} onChange={onChange} value={value} />
      )}
      {field.type === "text" && field.helperText ? (
        <Text selectable style={{ color: colors.inkMuted, fontSize: 13 }}>
          {field.helperText}
        </Text>
      ) : null}
    </View>
  );
}

function DynamicSelectField({
  field,
  onChange,
  value,
}: {
  field: SelectField;
  onChange: (name: string, value: string) => void;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {field.options.map((option) => (
        <DynamicSelectOption
          isSelected={value === option.value}
          key={option.value}
          label={option.label}
          onPress={() => onChange(field.name, option.value)}
        />
      ))}
    </View>
  );
}

function DynamicSelectOption({
  isSelected,
  label,
  onPress,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}

function DynamicTextField({
  field,
  onChange,
  value,
}: {
  field: TextField;
  onChange: (name: string, value: string) => void;
  value: string;
}) {
  return (
    <TextInput
      keyboardType={field.keyboardType}
      onChangeText={(text) => onChange(field.name, text)}
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
      value={value}
    />
  );
}

function DynamicAssetFormMessage({
  error,
  mode,
  savedTitle,
}: {
  error: string | null;
  mode: "add" | "edit";
  savedTitle: string | null;
}) {
  if (error) {
    return (
      <Text selectable style={{ color: colors.danger, fontSize: 15 }}>
        {error}
      </Text>
    );
  }

  if (!savedTitle) return null;

  return (
    <Text selectable style={{ color: colors.action, fontSize: 15 }}>
      {mode === "add" ? "Added locally: " : "Updated: "}
      {savedTitle}
    </Text>
  );
}

function DynamicAssetSaveButton({
  isSaving,
  mode,
  onSave,
}: {
  isSaving: boolean;
  mode: "add" | "edit";
  onSave: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isSaving}
      onPress={() => {
        void onSave();
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
  );
}
