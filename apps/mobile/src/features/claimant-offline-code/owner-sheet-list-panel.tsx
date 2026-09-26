import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import {
  BodyText,
  CodeField,
  NoticeBox,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
} from "@/shared/ui";

import { useOwnerSheetListHandle } from "./owner-sheet-runtime";
import { ownerSheetListView } from "./owner-sheet-list-view-model";

const noFlow = () => () => undefined;

/** Slice 6J: "My emergency sheets" — dates, status and references only, with revoke for active sheets. */
export function OwnerSheetListPanel() {
  const flow = useOwnerSheetListHandle();
  const readState = () => flow?.getState() ?? null;
  const state = useSyncExternalStore(flow?.subscribe ?? noFlow, readState, readState);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!flow) return undefined;
    void flow.load();
    return () => flow.close();
  }, [flow]);

  const view = ownerSheetListView(state);
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
      {view.rows.map((row) => (
        <View key={row.id} style={{ borderColor: colors.gold, borderRadius: 12, borderWidth: 1, gap: 6, padding: 14 }}>
          <BodyText>{`Ref ${row.reference} · ${row.statusLabel}`}</BodyText>
          <BodyText>{`${row.printed} · ${row.validity}`}</BodyText>
          {row.canRevoke && !view.confirmReference && !view.busy && !view.showMfaField ? (
            <OutlineButton label="Revoke" onPress={() => flow?.requestRevoke(row.id)} />
          ) : null}
        </View>
      ))}
      {view.showMfaField ? (
        <CodeField accessibilityLabel="Authenticator code" onChangeText={setCode} value={code} />
      ) : null}
      {view.confirmReference ? (
        <View style={{ gap: 12, marginTop: "auto" }}>
          {view.showMfaField ? (
            <PrimaryButton disabled={!/^\d{6}$/u.test(code)} label="Confirm"
              onPress={() => { const value = code; setCode(""); void flow?.submitMfaCode(value); }} />
          ) : (
            <PrimaryButton label="Revoke sheet" onPress={() => void flow?.confirmRevoke()} />
          )}
          <OutlineButton label="Keep it" onPress={() => { setCode(""); flow?.cancelRevoke(); }} />
        </View>
      ) : null}
      {view.showRetry ? <PrimaryButton label="Try again" onPress={() => void flow?.load()} /> : null}
    </View>
  );
}
