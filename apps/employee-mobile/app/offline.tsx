import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Screen } from "@/components/ui";
import { colors } from "@/theme/colors";

/** Mirrors web /offline PWA fallback. */
export default function OfflineScreen() {
  const router = useRouter();
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{"You're offline"}</Text>
        <Text style={styles.copy}>
          Check your internet connection, then try again. Some screens need the
          ERP API to load.
        </Text>
        <Button title="Try again" onPress={() => router.replace("/(tabs)/home")} />
        <Button
          title="Go to Home"
          variant="secondary"
          onPress={() => router.replace("/(tabs)/home")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  card: {
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.35)",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#0b1c30" },
  copy: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
});
