import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { usePreventScreenCapture } from "expo-screen-capture";

import { useVaultSession } from "@/features/vault";
import { colors } from "@/shared/theme/colors";
import {
  BodyText,
  CheckboxRow,
  CodeField,
  NoticeBox,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
} from "@/shared/ui";

import type { OwnerSheetFlow, OwnerSheetFlowState } from "./owner-sheet-flow";
import { useOwnerSheetFlowHandle } from "./owner-sheet-runtime";
import { ownerSheetView, type OwnerSheetAction } from "./owner-sheet-view-model";

const noFlow = () => () => undefined;

export function OwnerEmergencySheetPanel() {
  const flow = useOwnerSheetFlowHandle();
  const { isLocked } = useVaultSession();
  const state = useSyncExternalStore(flow?.subscribe ?? noFlow, () => flow?.getState() ?? null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkedPrint, setCheckedPrint] = useState(false);
  const [code, setCode] = useState("");

  usePreventScreenCapture();
  useSheetAbandonment(flow, isLocked);

  const view = ownerSheetView(state);
  const run = (action: OwnerSheetAction) => {
    if (!flow) return;
    if (action === "start") void flow.start();
    if (action === "submit_mfa") { const value = code; setCode(""); void flow.submitMfaCode(value); }
    if (action === "print") { setCheckedPrint(false); void flow.print(); }
    if (action === "confirm") flow.confirmPrinted();
  };
  const primaryDisabled = !view.primary || (view.showAcknowledgement && !acknowledged)
    || (view.showMfaField && !/^\d{6}$/u.test(code)) || (view.showPrintCheck && !checkedPrint);

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
      {view.busy ? <ActivityIndicator color={colors.gold} /> : null}
      {view.showAcknowledgement ? (
        <CheckboxRow checked={acknowledged} label="I will keep the printed sheet somewhere safe and private."
          onToggle={() => setAcknowledged((current) => !current)} />
      ) : null}
      {view.showMfaField ? (
        <CodeField accessibilityLabel="Authenticator code" onChangeText={setCode} value={code} />
      ) : null}
      {view.showPrintCheck ? (
        <CheckboxRow checked={checkedPrint} label="The QR code is sharp and both codes are readable."
          onToggle={() => setCheckedPrint((current) => !current)} />
      ) : null}
      {view.primary || view.secondary ? (
        <View style={{ gap: 12, marginTop: "auto" }}>
          {view.primary ? (
            <PrimaryButton disabled={primaryDisabled} label={view.primary.label}
              onPress={() => run(view.primary!.action)} />
          ) : null}
          {view.secondary ? (
            <OutlineButton label={view.secondary.label} onPress={() => run(view.secondary!.action)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Leaving the screen, backgrounding the app or locking the vault cancels an unconfirmed sheet. */
function useSheetAbandonment(flow: OwnerSheetFlow | null, isLocked: boolean) {
  useEffect(() => {
    if (!flow) return undefined;
    const subscription = AppState.addEventListener("change", (next) => {
      void flow.handleAppState(next);
    });
    return () => { subscription.remove(); void flow.abandon(); };
  }, [flow]);
  useEffect(() => { if (flow && isLocked) void flow.abandon(); }, [flow, isLocked]);
}

export type { OwnerSheetFlowState };
