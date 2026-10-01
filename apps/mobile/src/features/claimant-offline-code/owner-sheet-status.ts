import type { OwnerOfflineCodeSheetSummary } from "./owner-offline-code-client";
import type { OwnerSheetSaveResult } from "./owner-sheet-copy";

/** Active looks usable; revoked and expired never do. */
export type OwnerSheetBadge = Readonly<{ label: "Active" | "Revoked" | "Expired"; tone: "active" | "revoked" | "expired" }>;

export function ownerSheetStatusBadge(status: OwnerOfflineCodeSheetSummary["status"]): OwnerSheetBadge {
  if (status === "active") return { label: "Active", tone: "active" };
  return status === "revoked" ? { label: "Revoked", tone: "revoked" } : { label: "Expired", tone: "expired" };
}

export type OwnerSheetNotice = Readonly<{ variant: "success" | "danger"; title: string; message: string }>;

/** What the owner is told after Save PDF. A share sheet can't prove a save, so it never claims one. */
export function ownerSheetSaveNotice(result: OwnerSheetSaveResult | null): OwnerSheetNotice | null {
  if (!result) return null;
  switch (result.status) {
    case "saved":
      return { variant: "success", title: "PDF saved",
        message: result.folder ? `Saved as ${result.fileName} in ${result.folder}.` : `Saved as ${result.fileName}.` };
    case "shared":
      return { variant: "success", title: "Save dialog closed",
        message: "We can't confirm where it was saved. You can save it again any time from My emergency sheets." };
    case "cancelled":
      return { variant: "danger", title: "Not saved", message: "Your sheet is still active. Save it when you're ready." };
    case "failed":
      return { variant: "danger", title: "Couldn't save the PDF", message: "Your sheet is still active. Try again." };
  }
}

export const ownerSheetPdfWarning =
  "This PDF can unlock your vault for the person you trust. Keep it private, as you would a will or a spare key.";
