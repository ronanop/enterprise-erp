import { useEffect, useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from "@/lib/biometric";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssFaceStatus, EssKyc } from "@/types/api";
import { colors } from "@/theme/colors";

export default function SecurityScreen() {
  const [kyc, setKyc] = useState<EssKyc | null>(null);
  const [face, setFace] = useState<EssFaceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    Promise.all([essService.kyc(), essService.faceStatus()])
      .then(([k, f]) => {
        setKyc(k.data);
        setFace(f.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load security",
        ),
      );

    void (async () => {
      const cap = await getBiometricCapability();
      setBioLabel(cap.label);
      setBioAvailable(cap.hardware && cap.enrolled);
      setBioEnabled(await isBiometricUnlockEnabled());
    })();
  }, []);

  async function onToggleBiometric(next: boolean) {
    setBioBusy(true);
    setError(null);
    try {
      if (next) {
        if (!bioAvailable) {
          setError(
            Platform.OS === "web"
              ? "Biometric unlock is not available on web."
              : `${bioLabel} is not set up on this device.`,
          );
          return;
        }
        const ok = await authenticateWithBiometrics(
          `Enable ${bioLabel} unlock`,
        );
        if (!ok) {
          setError("Could not verify biometrics.");
          return;
        }
      }
      await setBiometricUnlockEnabled(next);
      setBioEnabled(next);
    } catch {
      setError("Failed to update biometric unlock.");
    } finally {
      setBioBusy(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Security & KYC" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <Text style={styles.section}>App unlock</Text>
      <Card style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Unlock with {bioLabel}</Text>
            <Text style={styles.toggleHint}>
              {bioAvailable
                ? "Require biometrics when reopening the app"
                : "Not available on this device"}
            </Text>
          </View>
          <Switch
            value={bioEnabled}
            disabled={bioBusy || (!bioAvailable && !bioEnabled)}
            onValueChange={(v) => void onToggleBiometric(v)}
            trackColor={{ false: colors.outlineVariant, true: colors.primaryFixed }}
            thumbColor={bioEnabled ? colors.primary : "#f4f4f5"}
          />
        </View>
      </Card>

      <Text style={styles.section}>KYC</Text>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
        <ListRow title="Aadhaar" subtitle={kyc?.aadhaar_number ?? "—"} />
        <ListRow title="PAN" subtitle={kyc?.pan_number ?? "—"} />
        <ListRow title="UAN" subtitle={kyc?.uan_number ?? "—"} />
      </Card>
      <Text style={styles.section}>Face unlock</Text>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
        <ListRow
          title="Enrolled"
          subtitle={face?.enrolled ? "Yes" : "No"}
        />
        <ListRow
          title="Enabled"
          subtitle={face?.enabled ? "Yes" : "No"}
        />
        <ListRow
          title="Required at login"
          subtitle={face?.verification_required ? "Yes" : "No"}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  toggleCard: { paddingVertical: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleCopy: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  toggleHint: { fontSize: 12, color: colors.onSurfaceVariant },
});
