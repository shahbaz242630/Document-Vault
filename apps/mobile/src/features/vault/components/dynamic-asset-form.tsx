import { useState } from "react";
import { View, type KeyboardTypeOptions } from "react-native";

import {
  BodyText,
  Chip,
  ErrorText,
  Eyebrow,
  Field,
  FieldLabel,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

import {
  formatDynamicAssetFormError,
  getMissingRequiredFieldError,
} from "../dynamic-asset-form-validation";

type SelectField = {
  label: string;
  name: string;
  options: { label: string; value: string }[];
  required: boolean;
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
    <View style={{ flex: 1, gap: 16 }}>
      <ScreenHeader />

      <View style={{ gap: 8 }}>
        <Eyebrow>{categoryLabel}</Eyebrow>
        <SerifTitle size={28}>
          {mode === "add"
            ? `Add ${categoryLabel.toLowerCase()}`
            : `Edit ${categoryLabel.toLowerCase()}`}
        </SerifTitle>
        <Subtitle style={{ fontSize: 14.5, lineHeight: 22 }}>
          Only what your family would need to find it — no passwords, no full
          numbers.
        </Subtitle>
      </View>

      <View style={{ gap: 14 }}>
        {fields.map((field) => (
          <DynamicAssetField
            field={field}
            key={field.name}
            onChange={updateValue}
            value={values[field.name] ?? ""}
          />
        ))}
      </View>

      <DynamicAssetFormMessage error={error} mode={mode} savedTitle={savedTitle} />

      <View style={{ marginTop: "auto", paddingTop: 8 }}>
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? "Saving..." : "Save to vault"}
          onPress={() => {
            void saveAsset();
          }}
        />
      </View>
    </View>
  );

  async function saveAsset() {
    const requiredFieldError = getMissingRequiredFieldError(fields, values);
    if (requiredFieldError) {
      setError(requiredFieldError);
      return;
    }

    try {
      setIsSaving(true);
      await onSave?.(values);
      setSavedTitle(values.title ?? "Reference");
    } catch (caughtError) {
      setError(formatDynamicAssetFormError(caughtError, fields));
    } finally {
      setIsSaving(false);
    }
  }
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
  if (field.type === "select") {
    return (
      <View style={{ gap: 8 }}>
        <FieldLabel>{field.label}</FieldLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {field.options.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onPress={() => onChange(field.name, option.value)}
              selected={value === option.value}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <Field
      accessibilityLabel={`${field.name} field`}
      hint={field.helperText}
      keyboardType={field.keyboardType}
      label={field.label}
      onChangeText={(text) => onChange(field.name, text)}
      placeholder={field.required ? "Required" : "Optional"}
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
    return <ErrorText>{error}</ErrorText>;
  }

  if (!savedTitle) return null;

  return (
    <BodyText>
      {mode === "add" ? "Added locally: " : "Updated: "}
      {savedTitle}
    </BodyText>
  );
}
