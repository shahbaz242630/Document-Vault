import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { usePreventScreenCapture } from "expo-screen-capture";

import { BodyText, NoticeBox, PrimaryButton, ScreenHeader, SerifTitle } from "@/shared/ui";

import { createClaimFlow } from "./claim-flow";
import { useClaimFlowHandle } from "./claim-flow-context";
import { claimFlowView } from "./claim-flow-view-model";
import { ClaimSheetScanner } from "./claim-sheet-scanner";

export function ClaimFlowPanel() {
  const handle = useClaimFlowHandle();
  const flow = useMemo(() => createClaimFlow({ handle, newKey: () => Crypto.randomUUID() }), [handle]);
  const readStatus = () => flow.snapshot().status;
  const status = useSyncExternalStore(flow.subscribe, readStatus, readStatus);
  const [scanning, setScanning] = useState(false);

  usePreventScreenCapture();
  useEffect(() => () => flow.dispose(), [flow]);

  const onSheetScanned = useCallback((sheetText: string) => {
    setScanning(false);
    void flow.submit(sheetText);
  }, [flow]);
  const onCancel = useCallback(() => setScanning(false), []);

  const view = claimFlowView(status);
  return (
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader />
      <View style={{ gap: 10 }}>
        <SerifTitle>{view.title}</SerifTitle>
        <BodyText>{view.body}</BodyText>
      </View>
      {view.notice ? (
        <NoticeBox title={view.notice.title} variant={view.notice.variant}>{view.notice.message}</NoticeBox>
      ) : null}
      {view.scanLabel && scanning ? (
        <ClaimSheetScanner onCancel={onCancel} onSheetScanned={onSheetScanned} />
      ) : null}
      {view.scanLabel && !scanning ? (
        <View style={{ marginTop: "auto" }}>
          <PrimaryButton label={view.scanLabel} onPress={() => setScanning(true)} />
        </View>
      ) : null}
    </View>
  );
}
