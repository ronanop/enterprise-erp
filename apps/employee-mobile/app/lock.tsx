import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, ErrorBox, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  markSessionUnlocked,
} from "@/lib/biometric";
import { colors, radii } from "@/theme/colors";
import { env } from "@/utils/env";

export default function LockScreen() {
  const router = useRouter();
  const { me, signOut } = useAuth();
  const [label, setLabel] = useState("Biometrics");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBiometricCapability().then((c) => setLabel(c.label));
    void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock() {
    setLoading(true);
    setError(null);
    try {
      const ok = await authenticateWithBiometrics(`Unlock ${env.appName}`);
      if (!ok) {
        setError("Authentication cancelled or failed.");
        return;
      }
      markSessionUnlocked();
      router.replace("/(tabs)/home");
    } catch {
      setError("Biometric unlock is unavailable on this device.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>✓</Text>
        </View>
        <Text style={styles.title}>{env.appName}</Text>
        <Text style={styles.sub}>
          Welcome back{me?.display_name ? `, ${me.display_name.split(" ")[0]}` : ""}
        </Text>
        <Text style={styles.hint}>Use {label} to continue</Text>
      </View>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <View style={styles.actions}>
        <Button title={`Unlock with ${label}`} loading={loading} onPress={() => void unlock()} />
        <Button
          title="Sign out"
          variant="secondary"
          onPress={() => void signOut().then(() => router.replace("/login"))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", gap: 20 },
  hero: { alignItems: "center", gap: 8, marginBottom: 12 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 15, color: colors.onSurfaceVariant },
  hint: { fontSize: 13, color: colors.outline, marginTop: 4 },
  actions: { gap: 10 },
});
