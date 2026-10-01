import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  BodyText,
  CodeField,
  NoticeBox,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  TextButton,
} from "@/shared/ui";

import { useOwnerSheetListHandle } from "./owner-sheet-runtime";
import { ownerSheetListView, type OwnerSheetListRow } from "./owner-sheet-list-view-model";
import { OwnerSheetBadgeView } from "./owner-sheet-badge";

const noFlow = () => () => undefined;
type SheetAction = "open" | OwnerSheetListRow["actions"][number];

/** "My emergency sheets": references, dates and status. Tapping a sheet opens it; "⋯" lists its actions. */
export function OwnerSheetListPanel() {
  const flow = useOwnerSheetListHandle();
  const router = useRouter();
  const readState = () => flow?.getState() ?? null;
  const state = useSyncExternalStore(flow?.subscribe ?? noFlow, readState, readState);
  const [code, setCode] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!flow) return undefined;
    void flow.load();
    return () => flow.close();
  }, [flow]);

  const open = (id: string, action: SheetAction) => {
    setMenuFor(null);
    router.push({ pathname: "/settings/emergency-sheet-detail", params: { id, action } } as unknown as "/settings/re-auth");
  };
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
        <SheetRow key={row.id} menuOpen={menuFor === row.id} onAction={(action) => open(row.id, action)}
          onToggleMenu={() => setMenuFor((current) => (current === row.id ? null : row.id))} row={row} />
      ))}
      {view.showMfaField ? (
        <View style={{ gap: 12, marginTop: "auto" }}>
          <CodeField accessibilityLabel="Authenticator code" onChangeText={setCode} value={code} />
          <PrimaryButton disabled={!/^\d{6}$/u.test(code)} label="Confirm"
            onPress={() => { const value = code; setCode(""); void flow?.submitMfaCode(value); }} />
        </View>
      ) : null}
      {view.showRetry ? <PrimaryButton label="Try again" onPress={() => void flow?.load()} /> : null}
    </View>
  );
}

function SheetRow({ menuOpen, onAction, onToggleMenu, row }: {
  menuOpen: boolean; onAction: (action: SheetAction) => void; onToggleMenu: () => void; row: OwnerSheetListRow;
}) {
  return (
    <View style={{ borderColor: row.badge.tone === "active" ? colors.gold : colors.border, borderRadius: 12,
      borderWidth: 1, gap: 8, padding: 14 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
        <Pressable accessibilityHint="Opens this sheet" accessibilityLabel={`Sheet ${row.reference}, ${row.statusLabel}`}
          accessibilityRole="button" onPress={() => onAction("open")} style={{ flex: 1, gap: 6 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <BodyText>{`Ref ${row.reference}`}</BodyText>
            <OwnerSheetBadgeView badge={row.badge} />
          </View>
          <BodyText>{`${row.printed} · ${row.validity}`}</BodyText>
        </Pressable>
        {row.actions.length > 0 ? (
          <Pressable accessibilityLabel={`Actions for sheet ${row.reference}`} accessibilityRole="button"
            accessibilityState={{ expanded: menuOpen }} hitSlop={12} onPress={onToggleMenu}>
            <Text style={{ color: colors.ink, fontFamily: fonts.sans.semibold, fontSize: 20 }}>⋯</Text>
          </Pressable>
        ) : null}
      </View>
      {menuOpen ? (
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 8 }}>
          {row.actions.includes("view") ? <TextButton label="View sheet" onPress={() => onAction("view")} /> : null}
          {row.actions.includes("save") ? <TextButton label="Save PDF" onPress={() => onAction("save")} /> : null}
          {row.actions.includes("revoke") ? (
            <Pressable accessibilityRole="button" onPress={() => onAction("revoke")} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.danger, fontFamily: fonts.sans.semibold, textAlign: "center" }}>
                Revoke sheet…
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
