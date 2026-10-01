import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { ActivityIndicator, Text, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  ErrorText,
  MutedText,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import {
  createTotpEnrollmentService,
  type TotpEnrollmentServiceResult,
} from "../totp-enrollment-service";
import {
  createTotpEnrollmentViewModel,
  totpEnrollmentNextRoute,
  type TotpEnrollmentFlow,
} from "../totp-enrollment-view-model";
import { formatTotpSetupKey } from "../totp-qr-matrix";
import { TotpQrCode } from "./totp-qr-code";

const startFailed: TotpEnrollmentServiceResult = {
  message: "Two-factor setup could not be started.",
  status: "error",
};

export function TotpEnrollmentPanel({ flow = "onboarding" }: { flow?: TotpEnrollmentFlow }) {
  // The setup key is a secret: keep it out of screenshots and the app switcher.
  usePreventScreenCapture();
  const viewModel = createTotpEnrollmentViewModel(flow);
  const router = useRouter();
  const service = useMemo(() => createTotpEnrollmentService(createSupabaseClient()), []);
  const [enrollment, setEnrollment] = useState<TotpEnrollmentServiceResult | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setEnrollment(null);
    setEnrollment(await service.enroll().catch(() => startFailed));
  }, [service]);

  useEffect(() => {
    // One factor per visit, even when effects run twice in development.
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  return (
    <View style={{ flex: 1, gap: 20 }}>
      {flow === "onboarding" ? <StepHeader step="security-1" /> : <ScreenHeader />}

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <EnrollmentBody enrollment={enrollment} onRetry={() => void start()} />

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={enrollment?.status !== "ok"}
          label={viewModel.primaryActionLabel}
          onPress={() => {
            if (enrollment?.status === "ok") {
              router.push(totpEnrollmentNextRoute(flow, enrollment.factorId));
            }
          }}
        />
      </View>
    </View>
  );
}

function EnrollmentBody({
  enrollment,
  onRetry,
}: {
  enrollment: TotpEnrollmentServiceResult | null;
  onRetry: () => void;
}) {
  if (!enrollment) {
    return <ActivityIndicator color={colors.gold} />;
  }

  if (enrollment.status !== "ok") {
    return (
      <View style={{ gap: 12 }}>
        <ErrorText>{enrollment.message}</ErrorText>
        <OutlineButton label="Try again" onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <TotpQrCode otpauthUri={enrollment.otpauthUri} />
      <MutedText style={{ fontSize: 13, textAlign: "center" }}>
        Can&apos;t scan it? Enter this setup key in your authenticator app instead.
      </MutedText>
      <Text
        selectable
        style={{
          color: colors.ink,
          fontFamily: fonts.mono.regular,
          fontSize: 15,
          textAlign: "center",
        }}
      >
        {formatTotpSetupKey(enrollment.secret)}
      </Text>
    </View>
  );
}
