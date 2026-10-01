import { useEffect, useState, useSyncExternalStore } from "react";
import { usePreventScreenCapture } from "expo-screen-capture";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";

import { useVaultSession } from "@/features/vault";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  BodyText,
  CodeField,
  MutedText,
  NoticeBox,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
} from "@/shared/ui";
import { QrCodeView } from "@/shared/ui/qr-code-view";

import { OwnerSheetBadgeView } from "./owner-sheet-badge";
import type { OwnerSheetDetailFlow } from "./owner-sheet-detail-flow";
import { ownerSheetDetailView, type OwnerSheetDetailAction } from "./owner-sheet-detail-view-model";
import { useOwnerSheetDetailHandle } from "./owner-sheet-runtime";

const noFlow = () => () => undefined;

/**
 * PDF-first sheets: one sheet's screen. The sheet is drawn only after the owner taps "View sheet", with screen
 * capture blocked; leaving or locking drops the decrypted copy.
 */
export function OwnerSheetDetailPanel({ locatorRecordId, initialAction }: {
  locatorRecordId: string; initialAction?: string;
}) {
  const flow = useOwnerSheetDetailHandle(locatorRecordId);
  const { isLocked } = useVaultSession();
  const readState = () => flow?.getState() ?? null;
  const state = useSyncExternalStore(flow?.subscribe ?? noFlow, readState, readState);
  const [code, setCode] = useState("");

  usePreventScreenCapture();
  useDetailLifecycle(flow, isLocked, initialAction);

  const view = ownerSheetDetailView(state);
  const run = (action: OwnerSheetDetailAction) => {
    if (!flow) return;
    if (action === "view") flow.reveal();
    if (action === "hide") flow.hide();
    if (action === "save") void flow.save("folder");
    if (action === "share") void flow.save("share");
    if (action === "print") void flow.print();
    if (action === "revoke") flow.requestRevoke();
    if (action === "confirm_revoke") void flow.confirmRevoke();
    if (action === "cancel_revoke") { setCode(""); flow.cancelRevoke(); }
    if (action === "submit_mfa") { const value = code; setCode(""); void flow.submitMfaCode(value); }
    if (action === "retry") void flow.load();
  };

  return (
    <View style={{ flex: 1, gap: 20 }}>
      <ScreenHeader />
      <View style={{ gap: 10 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <SerifTitle>{view.title}</SerifTitle>
          {view.badge ? <OwnerSheetBadgeView badge={view.badge} /> : null}
        </View>
        {view.dates.map((line) => <MutedText key={line}>{line}</MutedText>)}
        <BodyText>{view.body}</BodyText>
      </View>
      {view.notice ? (
        <NoticeBox title={view.notice.title} variant={view.notice.variant}>{view.notice.message}</NoticeBox>
      ) : null}
      {view.busy ? <ActivityIndicator color={colors.gold} /> : null}
      <RevealedSheet flow={flow} revealed={state?.revealed ?? false} />
      {view.showMfaField ? (
        <CodeField accessibilityLabel="Authenticator code" onChangeText={setCode} value={code} />
      ) : null}
      <View style={{ gap: 12, marginTop: "auto" }}>
        {view.actions.map((entry, index) => index === 0 && entry.action !== "cancel_revoke" ? (
          <PrimaryButton disabled={entry.action === "submit_mfa" && !/^\d{6}$/u.test(code)} key={entry.action}
            label={entry.label} onPress={() => run(entry.action)} />
        ) : (
          <OutlineButton key={entry.action} label={entry.label} onPress={() => run(entry.action)} />
        ))}
        {view.dangerAction ? (
          <Pressable accessibilityRole="button" onPress={() => run(view.dangerAction!.action)}
            style={{ borderColor: colors.danger, borderRadius: 12, borderWidth: 1, marginTop: 8, paddingVertical: 14 }}>
            <Text style={{ color: colors.danger, fontFamily: fonts.sans.semibold, textAlign: "center" }}>
              {view.dangerAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RevealedSheet({ flow, revealed }: { flow: OwnerSheetDetailFlow | null; revealed: boolean }) {
  const { width } = useWindowDimensions();
  const sheet = revealed ? flow?.revealedSheet() ?? null : null;
  if (!sheet) return null;
  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <QrCodeView accessibilityLabel="Emergency sheet QR code" data={sheet.sheetPayload} size={Math.min(width - 48, 360)} />
      <MutedText>Sheet code</MutedText>
      <Text selectable={false} style={{ color: colors.ink, fontFamily: fonts.mono.regular }}>{sheet.printedLocator}</Text>
      <MutedText>Secret code</MutedText>
      <Text selectable={false} style={{ color: colors.ink, fontFamily: fonts.mono.regular }}>{sheet.printedSecret}</Text>
    </View>
  );
}

/** Loads on open, runs the action the list asked for once, and drops everything on leaving or locking. */
function useDetailLifecycle(flow: OwnerSheetDetailFlow | null, isLocked: boolean, initialAction?: string) {
  useEffect(() => {
    if (!flow) return undefined;
    let cancelled = false;
    void flow.load().then(() => {
      if (cancelled || flow.getState().status !== "active") return;
      if (initialAction === "view") flow.reveal();
      if (initialAction === "save") void flow.save("folder");
      if (initialAction === "revoke") flow.requestRevoke();
    });
    return () => { cancelled = true; flow.close(); };
  }, [flow, initialAction]);
  useEffect(() => { if (flow && isLocked) flow.close(); }, [flow, isLocked]);
}
