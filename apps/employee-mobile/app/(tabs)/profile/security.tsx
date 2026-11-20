import { useEffect, useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconUser } from "@/components/icons";
import {
  AlertBox,
  Button,
  Card,
  ErrorBox,
  ListRow,
  Screen,
} from "@/components/ui";
import { clearFaceVerified } from "@/lib/face-auth";
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
import { RADIUS_CARD } from "@/theme/tokens";

export default function SecurityScreen() {
  const router = useRouter();
  const [kyc, setKyc] = useState<EssKyc | null>(null);
  const [face, setFace] = useState<EssFaceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);

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

  async function onToggleFaceLogin(next: boolean) {
    if (!face?.enrolled) return;
    setFaceBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await essService.faceSetEnabled(next);
      setFace(res.data);
      await clearFaceVerified();
      setMessage(
        res.data?.enabled
          ? "Face verification enabled for app access."
          : "Face verification disabled.",
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Update failed",
      );
    } finally {
      setFaceBusy(false);
    }
  }

  async function onEnrollFace() {
    setFaceBusy(true);
    setError(null);
    setMessage(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera permission is required to enroll your face.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
        allowsEditing: true,
        aspect: [1, 1],
        cameraType: ImagePicker.CameraType.front,
      });
      if (result.canceled || !result.assets[0]?.base64) {
        setError("Capture cancelled.");
        return;
      }
      const res = await essService.faceEnroll(result.assets[0].base64);
      setFace(res.data);
      await clearFaceVerified();
      setMessage("Face enrolled. You will verify on next sign-in.");
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Enrollment failed",
      );
    } finally {
      setFaceBusy(false);
    }
  }

  const faceHint = !face
    ? "Loading…"
    : face.enrolled
      ? face.enabled
        ? "Required after password login"
        : "Enrolled but turned off"
      : "Not enrolled — others could use your password";

  return (
    <Screen
      scroll
      header={<SubHeader title="Security & KYC" />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

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
            trackColor={{
              false: colors.outlineVariant,
              true: colors.primaryFixed,
            }}
            thumbColor={bioEnabled ? colors.primary : "#f4f4f5"}
          />
        </View>
      </Card>

      <View style={styles.faceBanner}>
        <View style={styles.faceBannerIcon}>
          <IconUser size={22} color="#ffffff" />
        </View>
        <View style={styles.faceBannerCopy}>
          <Text style={styles.faceBannerTitle}>Face verification</Text>
          <Text style={styles.faceBannerSub}>{faceHint}</Text>
        </View>
      </View>

      {face ? (
        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Require face on login</Text>
              <Text style={styles.toggleHint}>
                Blocks access if face does not match
              </Text>
            </View>
            <Switch
              value={face.enabled}
              disabled={faceBusy || !face.enrolled}
              onValueChange={(v) => void onToggleFaceLogin(v)}
              trackColor={{
                false: colors.outlineVariant,
                true: colors.primaryFixed,
              }}
              thumbColor={face.enabled ? colors.primary : "#f4f4f5"}
            />
          </View>
        </Card>
      ) : null}

      <Button
        title={face?.enrolled ? "Re-enroll face" : "Enroll face"}
        loading={faceBusy}
        onPress={() => void onEnrollFace()}
      />
      <Text style={styles.faceGuide}>
        Look at the camera in good light. Use the same face you will use at
        login.
      </Text>

      <Text style={styles.section}>KYC</Text>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
        <ListRow title="Aadhaar" subtitle={kyc?.aadhaar_number ?? "—"} />
        <ListRow title="PAN" subtitle={kyc?.pan_number ?? "—"} />
        <ListRow title="UAN" subtitle={kyc?.uan_number ?? "—"} />
      </Card>
      <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
        <ListRow title="Enrolled" subtitle={face?.enrolled ? "Yes" : "No"} />
        <ListRow title="Enabled" subtitle={face?.enabled ? "Yes" : "No"} />
        <ListRow
          title="Required at login"
          subtitle={face?.verification_required ? "Yes" : "No"}
        />
      </Card>

      <Text
        style={styles.changePassword}
        onPress={() => router.push("/(tabs)/profile/change-password")}
      >
        Change password
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12, paddingBottom: 24 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  toggleCard: { paddingVertical: 14, paddingHorizontal: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleCopy: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  toggleHint: { fontSize: 12, color: colors.onSurfaceVariant },
  faceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS_CARD,
    backgroundColor: "#2563eb",
    padding: 16,
  },
  faceBannerIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  faceBannerCopy: { flex: 1 },
  faceBannerTitle: { fontSize: 17, fontWeight: "600", color: "#ffffff" },
  faceBannerSub: { marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  faceGuide: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  changePassword: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});