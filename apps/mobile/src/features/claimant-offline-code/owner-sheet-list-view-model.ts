import type { OwnerSheetListState } from "./owner-sheet-list-flow";
import { ownerSheetReference } from "./owner-sheet-reference";

export type OwnerSheetListRow = Readonly<{
  id: string;
  reference: string;
  printed: string;
  validity: string;
  statusLabel: "Active" | "Revoked" | "Expired";
  canRevoke: boolean;
}>;

export type OwnerSheetListView = Readonly<{
  title: string;
  body: string;
  notice: Readonly<{ variant: "success" | "danger"; title: string; message: string }> | null;
  busy: boolean;
  rows: readonly OwnerSheetListRow[];
  /** Set while the owner confirms revoking the sheet with this reference. */
  confirmReference: string | null;
  showMfaField: boolean;
  showRetry: boolean;
}>;

const title = "My emergency sheets";
const none = { notice: null, busy: false, rows: [], confirmReference: null, showMfaField: false,
  showRetry: false } as const;

/** Slice 6J: what the "My emergency sheets" screen shows. It only ever holds dates, status and references. */
export function ownerSheetListView(state: OwnerSheetListState | null): OwnerSheetListView {
  if (!state) return { ...none, title, body: "Emergency sheets aren't available yet." };
  const rows = state.sheets.map(row);
  const selected = state.selected ? ownerSheetReference(state.selected) : null;
  switch (state.status) {
    case "loading":
      return { ...none, title, busy: true, body: "Loading your sheets." };
    case "failed":
      return { ...none, title, showRetry: true, body: "We couldn't load your sheets.",
        notice: { variant: "danger", title: "Sheets not loaded", message: "Check your connection and try again." } };
    case "confirming":
      return { ...none, title, rows, confirmReference: selected,
        body: `Revoke sheet ${selected}? Anyone holding this sheet will no longer be able to start a claim with it.` };
    case "revoking":
    case "verifying_mfa":
      return { ...none, title, rows, busy: true, body: "Revoking the sheet securely. Keep the app open." };
    case "needs_fresh_mfa":
      return { ...none, title, rows, showMfaField: true, confirmReference: selected,
        body: "Enter the 6-digit code from your authenticator app to confirm it's you.",
        notice: state.mfaRejected
          ? { variant: "danger", title: "Code not accepted", message: "Check the code and try again." } : null };
    case "ready":
      return { ...none, title, rows,
        body: rows.length === 0 ? "You haven't printed any emergency sheets yet."
          : "Each sheet shows the reference printed on it. Revoke any sheet that is lost or no longer with someone you trust.",
        notice: state.revokeFailed
          ? { variant: "danger", title: "Sheet not revoked", message: "Nothing changed. Please try again." }
          : state.revoked
            ? { variant: "success", title: "Sheet revoked", message: "It can no longer be used to start a claim." }
            : null };
  }
}

function row(sheet: OwnerSheetListState["sheets"][number]): OwnerSheetListRow {
  const statusLabel = sheet.status === "active" ? "Active" : sheet.status === "revoked" ? "Revoked" : "Expired";
  return { id: sheet.locatorRecordId, reference: ownerSheetReference(sheet.locatorRecordId),
    printed: `Printed ${formatDate(sheet.issuedAt)}`,
    validity: sheet.status === "revoked" && sheet.revokedAt ? `Revoked ${formatDate(sheet.revokedAt)}`
      : sheet.status === "expired" ? `Expired ${formatDate(sheet.expiresAt)}` : `Valid until ${formatDate(sheet.expiresAt)}`,
    statusLabel, canRevoke: sheet.status === "active" };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric",
    timeZone: "UTC" });
}
