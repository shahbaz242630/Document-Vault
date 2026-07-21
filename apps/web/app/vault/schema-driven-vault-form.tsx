import type { SchemaDrivenVaultCategoryDefinition } from "@vault/shared-validation";
import type { FormEvent } from "react";

export function SchemaDrivenVaultForm({ busy, definition, onSave }: {
  busy: boolean;
  definition: SchemaDrivenVaultCategoryDefinition;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return <form
    autoComplete="off"
    className="auth-form"
    data-asset-type={definition.assetType}
    onSubmit={onSave}
  >
    <h2>Add or update {definition.categoryLabel.toLowerCase()}</h2>
    <input name="id" type="hidden" />
    {definition.fields.map((field) => <SchemaDrivenField
      assetType={definition.assetType}
      field={field}
      key={field.name}
    />)}
    <button disabled={busy} type="submit">
      Encrypt and save {definition.categoryLabel.toLowerCase()}
    </button>
  </form>;
}

function SchemaDrivenField({ assetType, field }: {
  assetType: string;
  field: SchemaDrivenVaultCategoryDefinition["fields"][number];
}) {
  const id = `schema-${assetType}-${field.name}`;
  if (field.control === "select") return <>
    <label htmlFor={id}>{field.label}</label>
    <select defaultValue={field.defaultValue} id={id} name={field.name} required={field.required}>
      {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>
        {option.label}
      </option>)}
    </select>
    {field.helperText ? <p>{field.helperText}</p> : null}
  </>;
  if (field.control === "textarea") return <>
    <label htmlFor={id}>{field.label}</label>
    <textarea defaultValue={field.defaultValue} id={id} name={field.name} required={field.required} rows={3} />
    {field.helperText ? <p>{field.helperText}</p> : null}
  </>;
  return <>
    <label htmlFor={id}>{field.label}</label>
    <input
      defaultValue={field.defaultValue}
      id={id}
      inputMode={field.textInputMode}
      maxLength={field.maxLength}
      name={field.name}
      pattern={field.pattern}
      required={field.required}
      type={field.textInputMode === "tel" ? "tel" : "text"}
    />
    {field.helperText ? <p>{field.helperText}</p> : null}
  </>;
}
