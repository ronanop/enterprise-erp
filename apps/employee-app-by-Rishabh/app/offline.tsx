import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconAlert, IconBrand } from "@/components/icons";
import { Button, Card, Screen } from "@/components/ui";
import { colors } from "@/theme/colors";

export default function OfflineScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.center}>
          <IconBrand size={56} />
        </View>
        <View style={[styles.center, styles.alertTile]}>
          <IconAlert size={24} color="#b45309" />
        </View>
        <Text style={styles.title}>You&apos;re offline</Text>
        <Text style={styles.body}>
          Reconnect to sync leave, attendance, and payslips.
        </Text>
        <Button title="Try again" onPress={() => router.replace("/(tabs)/feed")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  card: { gap: 16, padding: 24 },
  center: { alignItems: "center" },
  alertTile: {
    alignSelf: "center",
    width: 48,
    height: 48,
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  title: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
  },
  body: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
  },
});
