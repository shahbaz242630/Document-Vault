import type { ClaimantChecklistItemKey } from "../checklist/contracts";

export const syntheticEvidencePlaceholderSizeLimitBytes = 25 * 1024 * 1024;

export function syntheticEvidenceDisplayLabel(
  itemKey: ClaimantChecklistItemKey,
): string {
  return `Synthetic placeholder: ${itemKey}`;
}
