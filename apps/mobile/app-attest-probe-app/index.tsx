import { useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";

import { claimantAppAttestNative } from "../modules/claimant-key-custody/src";
import {
  createClaimantAppAttestEvidenceRunner,
  type AppAttestEvidenceReport,
} from "../src/features/claimant-custody/app-attest-evidence-runner";

export default function ClaimantAppAttestProbeScreen() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AppAttestEvidenceReport | null>(null);
  const [safeError, setSafeError] = useState<string | null>(null);

  async function runProbe() {
    setRunning(true);
    setReport(null);
    setSafeError(null);
    try {
      if (Platform.OS !== "ios" || !claimantAppAttestNative) {
        setSafeError("This probe requires the isolated physical-iPhone App Attest build.");
        return;
      }
      const runner = createClaimantAppAttestEvidenceRunner(
        claimantAppAttestNative,
        () => new Date().toISOString(),
      );
      setReport(await runner.run({
        build_profile: "claimant_app_attest_probe",
        ios_27_or_later_confirmed: true,
        operator_confirmed: true,
        physical_device_confirmed: true,
        platform: "ios",
        production_runtime: false,
        run_id: Crypto.randomUUID(),
        value_free_capture: true,
      }));
    } catch {
      setSafeError("The value-free App Attest probe could not complete.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>INTERNAL APP ATTEST EVIDENCE</Text>
        <Text style={styles.title}>Claimant App Attest probe</Text>
        <Text style={styles.body}>
          This isolated iOS 27+ build generates one test App Attest key, authenticates
          synthetic opaque registration and assertion bytes, and clears the local key
          identifier. Apple does not provide an API for deleting the underlying App Attest key.
        </Text>
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            No claimant identity, invitation, vault material, key identifier, attestation,
            assertion, receipt, counter, certificate, or native error is displayed or logged.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={running}
          onPress={() => void runProbe()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, running && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{running ? "Probe running…" : "Confirm and run probe"}</Text>
        </Pressable>
        {safeError ? <Text style={styles.error}>{safeError}</Text> : null}
        {report ? (
          <View style={styles.report}>
            <Text style={styles.reportTitle}>{report.passed ? "PASS" : "FAIL"}</Text>
            <Result label="Run" value={report.run_id} />
            <Result label="Registration" value={report.registration_result_class} />
            <Result label="Assertion" value={report.assertion_result_class} />
            <Result label="Identifier cleanup" value={report.cleanup_result_class} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#F4F1EA", flex: 1 },
  content: { gap: 20, padding: 24 },
  eyebrow: { color: "#6A6257", fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: "#1C2522", fontSize: 32, fontWeight: "700" },
  body: { color: "#34413D", fontSize: 17, lineHeight: 26 },
  warning: { backgroundColor: "#FFF1CF", borderColor: "#D49A22", borderRadius: 12, borderWidth: 1, padding: 16 },
  warningText: { color: "#59400D", fontSize: 15, lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: "#175E50", borderRadius: 12, padding: 17 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  error: { color: "#A12A2A", fontSize: 15 },
  report: { backgroundColor: "#FFFFFF", borderColor: "#D9D4C8", borderRadius: 14, borderWidth: 1, gap: 12, padding: 18 },
  reportTitle: { color: "#175E50", fontSize: 24, fontWeight: "800" },
  row: { gap: 4 },
  label: { color: "#6A6257", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  value: { color: "#1C2522", fontSize: 15 },
});
