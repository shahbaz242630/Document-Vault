import type { OwnerSheetFlowState } from "./owner-sheet-flow";

export type OwnerSheetAction = "start" | "submit_mfa" | "print" | "confirm";

export type OwnerSheetView = Readonly<{
  title: string;
  body: string;
  notice: Readonly<{ variant: "success" | "danger"; title: string; message: string }> | null;
  busy: boolean;
  showAcknowledgement: boolean;
  showMfaField: boolean;
  showPrintCheck: boolean;
  primary: Readonly<{ label: string; action: OwnerSheetAction }> | null;
  secondary: Readonly<{ label: string; action: OwnerSheetAction }> | null;
}>;

const title = "Print an emergency sheet";
const none = { notice: null, busy: false, showAcknowledgement: false, showMfaField: false, showPrintCheck: false,
  primary: null, secondary: null } as const;

export function ownerSheetView(state: OwnerSheetFlowState | null): OwnerSheetView {
  if (!state) return { ...none, title, body: "Emergency sheets aren't available yet." };
  switch (state.status) {
    case "idle":
      return { ...none, title, showAcknowledgement: true, primary: { label: "Create and print sheet", action: "start" },
        body: "Your next of kin can use a printed sheet with a QR code to start a claim if something happens to you. "
          + "Sanduqkin reviews every claim before anything is released." };
    case "generating":
    case "registering":
    case "verifying_mfa":
      return { ...none, title, busy: true, body: "Creating your sheet securely. Keep the app open." };
    case "needs_fresh_mfa":
      return { ...none, title, showMfaField: true, primary: { label: "Confirm", action: "submit_mfa" },
        body: "Enter the 6-digit code from your authenticator app to confirm it's you.",
        notice: state.mfaRejected
          ? { variant: "danger", title: "Code not accepted", message: "Check the code and try again." } : null };
    case "ready_to_print":
      return { ...none, title, primary: { label: "Print sheet", action: "print" },
        body: "Your sheet is ready. Print it now; it isn't saved on this phone.",
        notice: state.printFailed
          ? { variant: "danger", title: "Printing didn't finish", message: "Check your printer and try again." } : null };
    case "printing":
      return { ...none, title, busy: true, body: "Opening the print dialog." };
    case "printed":
      return { ...none, title, showPrintCheck: true, primary: { label: "Confirm sheet printed", action: "confirm" },
        secondary: { label: "Print again", action: "print" },
        body: "Check the printed sheet: the QR code is sharp and both codes are readable. "
          + "If you leave before confirming, this sheet is cancelled." };
    case "done":
      return { ...none, title, body: "Keep the printed sheet somewhere safe and private.",
        notice: { variant: "success", title: "Emergency sheet active",
          message: state.expiresAt ? `It is valid until ${formatDate(state.expiresAt)}.` : "It is now active." } };
    case "failed":
      return { ...none, title, primary: { label: "Try again", action: "start" },
        body: "We couldn't create your sheet.",
        notice: { variant: "danger", title: "Sheet not created", message: "Nothing was printed and no sheet is active." } };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
