import type { ClaimFlowStatus } from "./claim-flow";

export type ClaimFlowView = Readonly<{
  title: string;
  body: string;
  notice: Readonly<{ variant: "success" | "danger"; title: string; message: string }> | null;
  /** The label of the button that opens the camera, or null when no sheet can be scanned. */
  scanLabel: string | null;
}>;

const title = "Start a claim with an emergency sheet";

export function claimFlowView(status: ClaimFlowStatus): ClaimFlowView {
  switch (status) {
    case "unavailable":
      return { title, body: "Claiming with an emergency sheet isn't available yet.", notice: null,
        scanLabel: null };
    case "ready":
      return { title, body: "Scan the QR code on the emergency sheet you were given.", notice: null,
        scanLabel: "Scan the QR code" };
    case "sheet_not_recognised":
      return { title, body: "Scan the QR code on the emergency sheet you were given.",
        notice: { variant: "danger", title: "Sheet not recognised",
          message: "Check that you are scanning the Sanduqkin emergency sheet QR code, then try again." },
        scanLabel: "Scan again" };
    case "checking":
      return { title, body: "Checking the emergency sheet securely. Keep the app open.", notice: null,
        scanLabel: null };
    case "claim_started":
      return { title, body: "Your claim has been started.",
        notice: { variant: "success", title: "Claim started",
          message: "Nothing has been released. The claim now goes through notice and review before any decision." },
        scanLabel: null };
    case "could_not_start":
      return { title, body: "We couldn't start the claim.",
        notice: { variant: "danger", title: "Claim not started",
          message: "Nothing was shared. Please try again later." },
        scanLabel: null };
    case "closed":
      return { title, body: "This claim attempt was closed for your safety.",
        notice: { variant: "danger", title: "Attempt closed",
          message: "The app was closed or locked before the claim finished. Nothing was shared." },
        scanLabel: null };
  }
}
