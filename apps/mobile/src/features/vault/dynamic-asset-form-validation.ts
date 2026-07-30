type FormField = {
  label: string;
  name: string;
  required: boolean;
};

type ZodLikeIssue = {
  code?: string;
  message?: string;
  path?: unknown[];
};

export function getMissingRequiredFieldError(
  fields: FormField[],
  values: Record<string, string>,
): string | null {
  const missingField = fields.find(
    (field) => field.required && (values[field.name] ?? "").trim().length === 0,
  );

  return missingField ? `${missingField.label} is required.` : null;
}

export function formatDynamicAssetFormError(
  error: unknown,
  fields: FormField[],
): string {
  const firstIssue = getZodLikeIssues(error)?.[0];

  if (firstIssue) {
    const fieldName =
      typeof firstIssue.path?.[0] === "string" ? firstIssue.path[0] : null;
    const field = fields.find((candidate) => candidate.name === fieldName);

    if (field?.required && firstIssue.code === "too_small") {
      return `${field.label} is required.`;
    }

    if (field && firstIssue.message) {
      return `${field.label}: ${firstIssue.message}`;
    }

    if (firstIssue.message) {
      return firstIssue.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "This reference could not be saved.";
}

function getZodLikeIssues(error: unknown): ZodLikeIssue[] | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("issues" in error) ||
    !Array.isArray(error.issues)
  ) {
    return null;
  }

  return error.issues as ZodLikeIssue[];
}
