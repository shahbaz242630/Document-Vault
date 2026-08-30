import { useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";

import {
  createOfflineCodeV2KdfEvidenceRunner,
  type OfflineCodeV2KdfEvidenceReport,
} from "../src/features/claimant-offline-code/offline-code-v2-kdf-evidence-runner";
import { createOfflineCodeV2PlatformProofProducer }
  from "../src/features/claimant-offline-code/offline-code-v2-proof-producer";
import { OFFLINE_CODE_V2_KDF_PROBE_FIXTURE as fixture }
  from "../src/features/claimant-offline-code/offline-code-v2-kdf-probe-fixture";

export default function OfflineCodeKdfProbeScreen() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<OfflineCodeV2KdfEvidenceReport | null>(null);
  const [safeError, setSafeError] = useState<string | null>(null);

  async function runProbe() {
    setRunning(true); setReport(null); setSafeError(null);
    try {
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        setSafeError("This probe requires the isolated physical-device build."); return;
      }
      const platform = Platform.OS;
      const producer = createOfflineCodeV2PlatformProofProducer(true);
      const runner = createOfflineCodeV2KdfEvidenceRunner({
        approved: true,
        benchmark: () => producer.benchmark({
          publicLocator: fixture.publicLocator,
          clientSecret: fixture.clientSecret,
          kdfProfile: fixture.kdfProfile,
          recordBinding: fixture.recordBinding,
          sampleCount: 5,
          device: {
            platform,
            evidenceClass: "physical",
            model: "operator-confirmed baseline device",
            osVersion: String(Platform.Version),
            cryptoRuntime: "react-native-libsodium",
          },
        }),
        now: () => new Date().toISOString(),
      });
      setReport(await runner.run({
        build_profile: "claimant_offline_code_kdf_probe",
        device_tier: `${platform}_baseline_supported`,
        low_power_mode_confirmed: false,
        operator_confirmed: true,
        physical_device_confirmed: true,
        platform,
        production_runtime: false,
        run_id: Crypto.randomUUID(),
        sample_count: 5,
        synthetic_material_confirmed: true,
        thermal_state_confirmed: "nominal",
        value_free_capture: true,
      }));
    } catch {
      setSafeError("The value-free KDF probe could not complete.");
    } finally { setRunning(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>INTERNAL PHYSICAL-DEVICE EVIDENCE</Text>
        <Text style={styles.title}>Offline-code KDF probe</Text>
        <Text style={styles.body}>
          Use only on an operator-confirmed baseline physical iPhone or Android device with nominal
          thermal state and low-power mode disabled. This isolated build runs five samples of the frozen
          synthetic Argon2id profile. A measurement is not production approval.
        </Text>
        <View style={styles.warning}><Text style={styles.warningText}>
          Do not enter claimant or vault information. The report omits the synthetic secret, salt, root,
          proof, individual timings, device model, OS version, and native errors.
        </Text></View>
        <Pressable accessibilityRole="button" disabled={running} onPress={() => void runProbe()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed,
            running && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{running ? "Measuring…" : "Confirm conditions and measure"}</Text>
        </Pressable>
        {safeError ? <Text style={styles.error}>{safeError}</Text> : null}
        {report ? <View style={styles.report}>
          <Text style={styles.reportTitle}>{report.result_class.toUpperCase()}</Text>
          <Result label="Run" value={report.run_id} />
          <Result label="Platform" value={report.platform} />
          <Result label="Device tier" value={report.device_tier} />
          <Result label="Profile" value={report.profile_id} />
          <Result label="Samples" value={String(report.sample_count)} />
          <Result label="Median (ms)" value={report.median_ms === null ? "unavailable" : String(report.median_ms)} />
          <Result label="P95 (ms)" value={report.p95_ms === null ? "unavailable" : String(report.p95_ms)} />
          <Result label="Production approved" value={report.production_approved ? "yes" : "no"} />
          <Result label="Started" value={report.started_at} />
          <Result label="Completed" value={report.completed_at} />
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text>
    <Text selectable style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#F4F1EA", flex: 1 },
  content: { gap: 20, padding: 24 },
  eyebrow: { color: "#6A6257", fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: "#1C2522", fontSize: 32, fontWeight: "700" },
  body: { color: "#34413D", fontSize: 17, lineHeight: 26 },
  warning: { backgroundColor: "#FFF1CF", borderColor: "#D49A22", borderRadius: 12,
    borderWidth: 1, padding: 16 },
  warningText: { color: "#59400D", fontSize: 15, lineHeight: 22 },
  button: { alignItems: "center", backgroundColor: "#175E50", borderRadius: 12, padding: 17 },
  buttonPressed: { opacity: 0.85 }, buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  error: { color: "#A12A2A", fontSize: 15 },
  report: { backgroundColor: "#FFFFFF", borderColor: "#D9D4C8", borderRadius: 14,
    borderWidth: 1, gap: 12, padding: 18 },
  reportTitle: { color: "#175E50", fontSize: 24, fontWeight: "800" },
  row: { gap: 4 },
  label: { color: "#6A6257", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  value: { color: "#1C2522", fontSize: 15 },
});
