import { useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SubHeader } from "@/components/AppHeader";
import { Button, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

export default function AssetScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const locked = useRef(false);

  async function lookup(code: string) {
    if (!code.trim() || locked.current) return;
    locked.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await essService.lookupAsset(code.trim());
      if (res.data?.id) {
        router.replace(`/assets/${res.data.id}`);
        return;
      }
      setError("Asset not found.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
      setTimeout(() => {
        locked.current = false;
      }, 1500);
    }
  }

  if (Platform.OS === "web") {
    return (
      <Screen header={<SubHeader title="Scan asset" />} contentStyle={styles.content}>
        <Text style={styles.help}>
          Camera scan works on iOS/Android. Enter an asset code manually.
        </Text>
        <TextField
          label="Asset code"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
          placeholder="MBP-2024-X42"
        />
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button
          title="Lookup"
          loading={loading}
          onPress={() => void lookup(manual)}
        />
      </Screen>
    );
  }

  if (!permission?.granted) {
    return (
      <Screen header={<SubHeader title="Scan asset" />} contentStyle={styles.content}>
        <Text style={styles.help}>Camera permission is required to scan.</Text>
        <Button title="Allow camera" onPress={() => void requestPermission()} />
        <TextField
          label="Or enter code"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
        />
        <Button title="Lookup" loading={loading} onPress={() => void lookup(manual)} />
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </Screen>
    );
  }

  return (
    <Screen
      header={<SubHeader title="Scan asset" />}
      contentStyle={{ paddingHorizontal: 0, paddingBottom: 0, flex: 1 }}
    >
      <View style={styles.wrap}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "code128", "ean13", "code39"],
          }}
          onBarcodeScanned={({ data }) => void lookup(data)}
        />
        <View style={styles.overlay}>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <Text style={styles.helpLight}>Point at asset QR / barcode</Text>
          <TextField
            label="Manual code"
            value={manual}
            onChangeText={setManual}
            autoCapitalize="characters"
          />
          <Button title="Lookup" loading={loading} onPress={() => void lookup(manual)} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.background,
  },
  content: { paddingTop: 12, gap: 12 },
  help: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20 },
  helpLight: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
});
