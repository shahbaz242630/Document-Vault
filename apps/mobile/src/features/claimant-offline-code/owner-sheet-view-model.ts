import type { OwnerSheetFlowState } from "./owner-sheet-flow";
import { ownerSheetPdfWarning, ownerSheetSaveNotice, type OwnerSheetNotice } from "./owner-sheet-status";

export type OwnerSheetAction = "start" | "submit_mfa" | "save" | "share" | "print" | "open_list";

export type OwnerSheetView = Readonly<{
  title: string;
  body: string;
  notice: OwnerSheetNotice | null;
  busy: boolean;
  showAcknowledgement: boolean;
  showMfaField: boolean;
  primary: Readonly<{ label: string; action: OwnerSheetAction }> | null;
  secondary: readonly Readonly<{ label: string; action: OwnerSheetAction }>[];
}>;

const title = "Create an emergency sheet";
const none = { notice: null, busy: false, showAcknowledgement: false, showMfaField: false, primary: null,
  secondary: [] } as const;

/** PDF-first (2026-10-01): create, then save as a PDF; printing is optional and nothing waits on a confirmation. */
export function ownerSheetView(state: OwnerSheetFlowState | null): OwnerSheetView {
  if (!state) return { ...none, title, body: "Emergency sheets aren't available yet." };
  switch (state.status) {
    case "idle":
      return { ...none, title, showAcknowledgement: true, primary: { label: "Create emergency sheet", action: "start" },
        body: "Create a sheet with a QR code and save it as a PDF. Your next of kin can use it to start a claim if "
          + `something happens to you, and Sanduqkin reviews every claim before anything is released. ${ownerSheetPdfWarning}` };
    case "generating":
    case "registering":
    case "verifying_mfa":
    case "storing":
      return { ...none, title, busy: true, body: "Creating your sheet securely. Keep the app open." };
    case "needs_fresh_mfa":
      return { ...none, title, showMfaField: true, primary: { label: "Confirm", action: "submit_mfa" },
        body: "Enter the 6-digit code from your authenticator app to confirm it's you.",
        notice: state.mfaRejected
          ? { variant: "danger", title: "Code not accepted", message: "Check the code and try again." } : null };
    case "ready":
      return { ...none, title, primary: { label: "Save PDF", action: "save" },
        secondary: [...(state.canPickFolder ? [{ label: "Share PDF…", action: "share" as const }] : []),
          { label: "Print (optional)", action: "print" }, { label: "Go to My emergency sheets", action: "open_list" }],
        body: `Sheet ${state.reference ?? ""} is active${state.expiresAt ? ` until ${formatDate(state.expiresAt)}` : ""}. `
          + "Save it as a PDF now. You can open it and save it again any time from My emergency sheets.",
        notice: state.printFailed
          ? { variant: "danger", title: "Printing didn't finish", message: "Your sheet is still active. Try again." }
          : ownerSheetSaveNotice(state.saveResult) };
    case "saving":
      return { ...none, title, busy: true, body: "Preparing your PDF." };
    case "printing":
      return { ...none, title, busy: true, body: "Opening the print dialog." };
    case "failed":
      return { ...none, title, primary: { label: "Try again", action: "start" },
        body: "We couldn't create your sheet.",
        notice: { variant: "danger", title: "Sheet not created", message: "Nothing was saved and no sheet is active." } };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
