/** The camera permission facts the scanner reads; null while the permission is still being checked. */
export type ClaimScannerPermission = Readonly<{ granted: boolean; canAskAgain: boolean }> | null;

export type ClaimScannerStage = "checking" | "asking" | "denied" | "camera";

export type ClaimScannerView = Readonly<{
  stage: ClaimScannerStage;
  /** Ask the operating system for camera access (only after the claimant chose to scan). */
  requestPermission: boolean;
  message: string | null;
  showOpenSettings: boolean;
}>;

export const claimScannerHelp = "Hold the emergency sheet flat, with the QR code inside the frame.";

/** Slice 6I: the camera is shown only once access is granted and the screen is in use. */
export function claimScannerView(permission: ClaimScannerPermission, active: boolean): ClaimScannerView {
  if (!permission) return { stage: "checking", requestPermission: false, message: null, showOpenSettings: false };
  if (!permission.granted && permission.canAskAgain)
    return { stage: "asking", requestPermission: true, message: null, showOpenSettings: false };
  if (!permission.granted)
    return { stage: "denied", requestPermission: false, showOpenSettings: true,
      message: "Sanduqkin needs the camera to read the emergency sheet. Allow camera access in Settings, then try again." };
  return { stage: active ? "camera" : "checking", requestPermission: false,
    message: active ? claimScannerHelp : null, showOpenSettings: false };
}
