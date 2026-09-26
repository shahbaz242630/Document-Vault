import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";

import { colors } from "@/shared/theme/colors";
import { BodyText, NoticeBox, OutlineButton } from "@/shared/ui";

import { createClaimSheetScan } from "./claim-sheet-scan";
import { claimScannerView } from "./claim-sheet-scanner-view-model";

type Props = Readonly<{ onSheetScanned: (sheetText: string) => void; onCancel: () => void }>;

/*
 * Slice 6I: the only place the app opens the camera. It is mounted only after the claimant taps "Scan the QR
 * code", scans QR codes only, takes no pictures or recordings, and is unmounted as soon as one sheet is read.
 */
export function ClaimSheetScanner({ onSheetScanned, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const asked = useRef(false);
  const scan = useMemo(() => createClaimSheetScan(onSheetScanned), [onSheetScanned]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setForeground(next === "active"));
    return () => { subscription.remove(); scan.close(); };
  }, [scan]);

  const view = claimScannerView(
    permission ? { granted: permission.granted, canAskAgain: permission.canAskAgain } : null, focused && foreground);

  useEffect(() => {
    if (!view.requestPermission || asked.current) return;
    asked.current = true;
    void requestPermission();
  }, [view.requestPermission, requestPermission]);

  return (
    <View style={{ gap: 16 }}>
      {view.stage === "camera" ? (
        <View style={{ aspectRatio: 1, borderColor: colors.gold, borderRadius: 16, borderWidth: 2, overflow: "hidden" }}>
          <CameraView
            active
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            facing="back"
            mute
            onBarcodeScanned={scan.onScan}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {view.stage === "denied" && view.message ? (
        <NoticeBox title="Camera access is off" variant="danger">{view.message}</NoticeBox>
      ) : view.message ? (
        <BodyText>{view.message}</BodyText>
      ) : null}
      {view.showOpenSettings ? <OutlineButton label="Open Settings" onPress={() => void Linking.openSettings()} /> : null}
      <OutlineButton label="Cancel" onPress={onCancel} />
    </View>
  );
}
