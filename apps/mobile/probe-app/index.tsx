import { useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";

import { claimantKeyCustodyNative } from "../modules/claimant-key-custody/src";
import {
  createClaimantPhysicalEvidenceRunner,
  type ClaimantPhysicalEvidenceReport,
} from "../src/features/claimant-custody/physical-evidence-runner";

export default function ClaimantCustodyProbeScreen() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ClaimantPhysicalEvidenceReport | null>(null);
  const [safeError, setSafeError] = useState<string | null>(null);

  async function runProbe() {
    setRunning(true);
    setReport(null);
    setSafeError(null);
    try {
      if (Platform.OS !== "ios" || !claimantKeyCustodyNative) {
        setSafeError("This probe requires the signed physical-iPhone test build.");
        return;
      }
      const runner = createClaimantPhysicalEvidenceRunner(
        claimantKeyCustodyNative,
        () => new Date().toISOString(),
      );
      setReport(await runner.run({
        build_profile: "claimant_custody_probe",
        operator_confirmed: true,
        passcode_set_confirmed: true,
        physical_device_confirmed: true,
        platform: "ios",
        production_runtime: false,
        run_id: Crypto.randomUUID(),
        value_free_capture: true,
      }));
    } catch {
      setSafeError("The value-free custody probe could not complete.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>INTERNAL PHYSICAL-DEVICE EVIDENCE</Text>
        <Text style={styles.title}>Claimant Secure Enclave probe</Text>
        <Text style={styles.body}>
          Use only on the registered test iPhone with a passcode enabled. Running the probe creates one
          disposable probe-only key, requests device-owner authentication, exercises the frozen V1
          possession transcript, and deletes the key.
        </Text>
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            The report is value-free. Do not enter claimant, invitation, account, or vault information and
            do not capture biometric prompts.
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
            <Result label="Capability" value={report.capability_result_class} />
            <Result label="Creation" value={report.creation_result_class} />
            <Result label="Exercise" value={report.exercise_result_class} />
            <Result label="Cleanup" value={report.cleanup_result_class} />
            <Result label="Key continuity" value={report.fingerprint_continuity ? "confirmed" : "not confirmed"} />
            <Result label="Started" value={report.started_at} />
            <Result label="Completed" value={report.completed_at} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
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
