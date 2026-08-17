import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, ErrorBox, Screen } from "@/components/ui";
import { markFaceVerified } from "@/lib/face-auth";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";
import { env } from "@/utils/env";

export default function FaceVerifyScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finish() {
    await markFaceVerified();
    router.replace((next as "/(tabs)/home") || "/(tabs)/home");
  }

  async function onCapture() {
    setLoading(true);
    setError(null);
    try {
      if (env.useMock) {
        await finish();
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera permission is required for face verification.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]?.base64) {
        setError("Capture cancelled.");
        return;
      }
      const verify = await essService.faceVerify(result.assets[0].base64);
      if (!verify.data?.verified) {
        setError(verify.data?.message || "Face verification failed.");
        return;
      }
      await finish();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Face verification failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.center}>
        <Text style={styles.title}>Face verification</Text>
        <Text style={styles.sub}>
          Confirm it&apos;s you to continue into the employee app.
        </Text>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button
          title={env.useMock ? "Continue (demo)" : "Take selfie"}
          loading={loading}
          onPress={() => void onCapture()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  center: { gap: 14, paddingVertical: 40 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
});
