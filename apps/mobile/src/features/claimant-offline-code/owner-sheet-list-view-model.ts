import type { OwnerSheetListState } from "./owner-sheet-list-flow";
import { ownerSheetReference } from "./owner-sheet-reference";
import { ownerSheetStatusBadge, type OwnerSheetBadge } from "./owner-sheet-status";

export type OwnerSheetListRow = Readonly<{
  id: string;
  reference: string;
  printed: string;
  validity: string;
  statusLabel: "Active" | "Revoked" | "Expired";
  badge: OwnerSheetBadge;
  /** Active sheets offer View, Save PDF and Revoke from their menu; the others only open their details. */
  actions: readonly ("view" | "save" | "revoke")[];
}>;

export type OwnerSheetListView = Readonly<{
  title: string;
  body: string;
  notice: Readonly<{ variant: "success" | "danger"; title: string; message: string }> | null;
  busy: boolean;
  rows: readonly OwnerSheetListRow[];
  showMfaField: boolean;
  showRetry: boolean;
}>;

const title = "My emergency sheets";
const none = { notice: null, busy: false, rows: [], showMfaField: false, showRetry: false } as const;

/** "My emergency sheets": references, dates and status only. Opening a row leads to the sheet's own screen. */
export function ownerSheetListView(state: OwnerSheetListState | null): OwnerSheetListView {
  if (!state) return { ...none, title, body: "Emergency sheets aren't available yet." };
  switch (state.status) {
    case "loading":
      return { ...none, title, busy: true, body: "Loading your sheets." };
    case "verifying_mfa":
      return { ...none, title, busy: true, body: "Checking your code." };
    case "failed":
      return { ...none, title, showRetry: true, body: "We couldn't load your sheets.",
        notice: { variant: "danger", title: "Sheets not loaded", message: failureMessage(state.loadFailure) } };
    case "needs_fresh_mfa":
      return { ...none, title, showMfaField: true,
        body: "To see your sheets, enter the 6-digit code from your authenticator app to confirm it's you.",
        notice: state.mfaRejected
          ? { variant: "danger", title: "Code not accepted", message: "Check the code and try again." } : null };
    case "ready": {
      const rows = state.sheets.map(row);
      return { ...none, title, rows,
        body: rows.length === 0 ? "You haven't created any emergency sheets yet."
          : "Tap a sheet to view it, save its PDF again or revoke it. Each sheet shows the reference printed on it." };
    }
  }
}

function failureMessage(failure: OwnerSheetListState["loadFailure"]): string {
  if (failure === "unreachable") return "The Sanduqkin server couldn't be reached. Check your connection and try again.";
  if (failure === "session") return "Your session couldn't be confirmed. Sign out, sign in again and retry.";
  return "The server couldn't return your sheets. Please try again.";
}

function row(sheet: OwnerSheetListState["sheets"][number]): OwnerSheetListRow {
  const statusLabel = sheet.status === "active" ? "Active" : sheet.status === "revoked" ? "Revoked" : "Expired";
  return { id: sheet.locatorRecordId, reference: ownerSheetReference(sheet.locatorRecordId),
    printed: `Created ${formatDate(sheet.issuedAt)}`,
    validity: sheet.status === "revoked" && sheet.revokedAt ? `Revoked ${formatDate(sheet.revokedAt)}`
      : sheet.status === "expired" ? `Expired ${formatDate(sheet.expiresAt)}` : `Valid until ${formatDate(sheet.expiresAt)}`,
    statusLabel, badge: ownerSheetStatusBadge(sheet.status),
    actions: sheet.status === "active" ? ["view", "save", "revoke"] : [] };
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric",
    timeZone: "UTC" });
}
