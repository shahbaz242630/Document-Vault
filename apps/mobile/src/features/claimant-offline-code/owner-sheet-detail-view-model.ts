import type { OwnerSheetDetailState } from "./owner-sheet-detail-flow";
import { formatDate } from "./owner-sheet-list-view-model";
import { ownerSheetReference } from "./owner-sheet-reference";
import {
  ownerSheetPdfWarning,
  ownerSheetSaveNotice,
  ownerSheetStatusBadge,
  type OwnerSheetBadge,
  type OwnerSheetNotice,
} from "./owner-sheet-status";

export type OwnerSheetDetailAction = "view" | "hide" | "save" | "share" | "print" | "revoke" | "confirm_revoke"
  | "cancel_revoke" | "submit_mfa" | "retry";

export type OwnerSheetDetailView = Readonly<{
  title: string;
  badge: OwnerSheetBadge | null;
  dates: readonly string[];
  body: string;
  notice: OwnerSheetNotice | null;
  busy: boolean;
  showMfaField: boolean;
  actions: readonly Readonly<{ label: string; action: OwnerSheetDetailAction }>[];
  /** Kept apart from the ordinary actions and drawn in the danger style. */
  dangerAction: Readonly<{ label: string; action: OwnerSheetDetailAction }> | null;
}>;

const none = { badge: null, dates: [], notice: null, busy: false, showMfaField: false, actions: [],
  dangerAction: null } as const;

/** PDF-first sheets: one sheet's screen. Revoked and expired sheets never offer view, save or print. */
export function ownerSheetDetailView(state: OwnerSheetDetailState | null): OwnerSheetDetailView {
  if (!state) return { ...none, title: "Emergency sheet", body: "Emergency sheets aren't available yet." };
  const summary = state.summary;
  const title = summary ? `Sheet ${ownerSheetReference(summary.locatorRecordId)}` : "Emergency sheet";
  const badge = summary ? ownerSheetStatusBadge(summary.status) : null;
  const dates = summary ? [`Created ${formatDate(summary.issuedAt)}`, summary.status === "revoked" && summary.revokedAt
    ? `Revoked ${formatDate(summary.revokedAt)}` : summary.status === "expired"
      ? `Expired ${formatDate(summary.expiresAt)}` : `Valid until ${formatDate(summary.expiresAt)}`] : [];
  const base = { ...none, title, badge, dates };
  switch (state.status) {
    case "loading":
      return { ...base, busy: true, body: "Opening your sheet." };
    case "locked":
      return { ...base, body: "Unlock your vault to open this sheet." };
    case "not_found":
      return { ...base, body: "This sheet isn't in your account." };
    case "failed":
      return { ...base, body: "We couldn't open this sheet.", actions: [{ label: "Try again", action: "retry" }],
        notice: { variant: "danger", title: "Sheet not loaded", message: "Check your connection and try again." } };
    case "revoked":
      return { ...base, body: "This sheet is revoked. It can't be used to start a claim, and it can't be viewed or saved.",
        notice: state.justRevoked ? { variant: "success", title: "Sheet revoked",
          message: "It can no longer be used to start a claim. Your other sheets are unchanged." } : null };
    case "expired":
      return { ...base, body: "This sheet has expired. It can't be used to start a claim, and it can't be viewed or saved." };
    case "saving":
      return { ...base, busy: true, body: "Preparing your PDF." };
    case "printing":
      return { ...base, busy: true, body: "Opening the print dialog." };
    case "revoking":
    case "verifying_mfa":
      return { ...base, busy: true, body: "Checking with Sanduqkin. Keep the app open." };
    case "confirming_revoke":
      return { ...base, body: `Revoke ${title.toLowerCase()}? Anyone holding it will no longer be able to start a claim. `
        + "This can't be undone.", actions: [{ label: "Keep it", action: "cancel_revoke" }],
      dangerAction: { label: "Revoke sheet", action: "confirm_revoke" } };
    case "needs_fresh_mfa":
      return { ...base, showMfaField: true,
        body: "Enter the 6-digit code from your authenticator app to confirm it's you.",
        actions: [{ label: "Confirm", action: "submit_mfa" }],
        notice: state.mfaRejected
          ? { variant: "danger", title: "Code not accepted", message: "Check the code and try again." } : null };
    case "active":
      return activeView(state, base);
  }
}

function activeView(state: OwnerSheetDetailState, base: Omit<OwnerSheetDetailView, "body">): OwnerSheetDetailView {
  const revoke = { label: "Revoke sheet", action: "revoke" as const };
  const failedRevoke: OwnerSheetNotice | null = state.revokeFailed
    ? { variant: "danger", title: "Sheet not revoked", message: "Nothing changed. Please try again." } : null;
  if (state.copy !== "available") {
    return { ...base, dangerAction: revoke, notice: failedRevoke,
      body: state.copy === "unreadable"
        ? "This device's copy of the sheet can't be opened. The sheet is still active. If you no longer have its PDF, "
          + "revoke it and create a new one."
        : "This device doesn't have a copy of this sheet. It is still active. If you no longer have its PDF, revoke it "
          + "and create a new one." };
  }
  return { ...base, dangerAction: revoke,
    body: `${ownerSheetPdfWarning} You can view it here or save its PDF again; it stays the same sheet.`,
    actions: [state.revealed ? { label: "Hide sheet", action: "hide" } : { label: "View sheet", action: "view" },
      { label: "Save PDF", action: "save" },
      ...(state.canPickFolder ? [{ label: "Share PDF…", action: "share" as const }] : []),
      { label: "Print", action: "print" }],
    notice: failedRevoke ?? (state.printFailed
      ? { variant: "danger", title: "Printing didn't finish", message: "Your sheet is still active. Try again." }
      : ownerSheetSaveNotice(state.saveResult)) };
}
