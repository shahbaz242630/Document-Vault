import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { usePreventScreenCapture } from "expo-screen-capture";

import { useSheetCheckHandle } from "@/features/claimant-offline-code/sheet-check-runtime";
import { BodyText, NoticeBox, OutlineButton, PrimaryButton, ScreenHeader, SerifTitle } from "@/shared/ui";

import { ClaimSheetScanner } from "./claim-sheet-scanner";
import { createSheetCheckFlow, sheetCheckView } from "./sheet-check-flow";

const noKey = () => "";

/** Staging wiring W2a (Preview build only): scan one emergency sheet and say whether it can be used. */
export function SheetCheckPanel() {
  const handle = useSheetCheckHandle();
  const flow = useMemo(() => handle?.open() ?? createSheetCheckFlow({ port: null, newKey: noKey }), [handle]);
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

  const view = sheetCheckView(status);
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
      {view.resetLabel ? (
        <View style={{ marginTop: "auto" }}>
          <OutlineButton label={view.resetLabel} onPress={() => flow.reset()} />
        </View>
      ) : null}
    </View>
  );
}
