import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
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

/** PDF-first (2026-10-01): create the sheet, then save it as a PDF; printing is optional. */
export function OwnerEmergencySheetPanel() {
  const flow = useOwnerSheetFlowHandle();
  const router = useRouter();
  const { isLocked } = useVaultSession();
  const state = useSyncExternalStore(flow?.subscribe ?? noFlow, () => flow?.getState() ?? null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [code, setCode] = useState("");

  usePreventScreenCapture();
  useSheetAbandonment(flow, isLocked);

  const view = ownerSheetView(state);
  const run = (action: OwnerSheetAction) => {
    if (!flow) return;
    if (action === "start") void flow.start();
    if (action === "submit_mfa") { const value = code; setCode(""); void flow.submitMfaCode(value); }
    if (action === "save") void flow.save("folder");
    if (action === "share") void flow.save("share");
    if (action === "print") void flow.print();
    if (action === "open_list") router.replace("/settings/emergency-sheets" as unknown as "/settings/re-auth");
  };
  const primaryDisabled = !view.primary || (view.showAcknowledgement && !acknowledged)
    || (view.showMfaField && !/^\d{6}$/u.test(code));

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
        <CheckboxRow checked={acknowledged}
          label="I understand this PDF can unlock my vault for someone I trust, and I will keep it private."
          onToggle={() => setAcknowledged((current) => !current)} />
      ) : null}
      {view.showMfaField ? (
        <CodeField accessibilityLabel="Authenticator code" onChangeText={setCode} value={code} />
      ) : null}
      {view.primary || view.secondary.length > 0 ? (
        <View style={{ gap: 12, marginTop: "auto" }}>
          {view.primary ? (
            <PrimaryButton disabled={primaryDisabled} label={view.primary.label}
              onPress={() => run(view.primary!.action)} />
          ) : null}
          {view.secondary.map((entry) => (
            <OutlineButton key={entry.action} label={entry.label} onPress={() => run(entry.action)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Leaving the screen, backgrounding or locking drops the sheet from memory. Only a sheet that never became active
 * is revoked; an active sheet stays active and opens again from My emergency sheets.
 */
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
