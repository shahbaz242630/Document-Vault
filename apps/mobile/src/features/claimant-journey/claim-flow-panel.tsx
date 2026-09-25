import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";

import { BodyText, NoticeBox, PrimaryButton, ScreenHeader, SerifTitle, TextAreaField } from "@/shared/ui";

import { createClaimFlow } from "./claim-flow";
import { useClaimFlowHandle } from "./claim-flow-context";
import { claimFlowView } from "./claim-flow-view-model";

export function ClaimFlowPanel() {
  const handle = useClaimFlowHandle();
  const flow = useMemo(() => createClaimFlow({ handle, newKey: () => Crypto.randomUUID() }), [handle]);
  const status = useSyncExternalStore(flow.subscribe, () => flow.snapshot().status);
  const [sheetText, setSheetText] = useState("");

  useEffect(() => () => flow.dispose(), [flow]);

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
      {view.showSheetField ? (
        <TextAreaField
          accessibilityLabel="Emergency sheet code"
          autoCapitalize="none"
          autoCorrect={false}
          label="Emergency sheet code"
          onChangeText={setSheetText}
          value={sheetText}
        />
      ) : null}
      {view.submitLabel ? (
        <View style={{ marginTop: "auto" }}>
          <PrimaryButton
            disabled={sheetText.length === 0}
            label={view.submitLabel}
            onPress={() => {
              const text = sheetText;
              setSheetText("");
              void flow.submit(text);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
