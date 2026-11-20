import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { IconCalendar } from "@/components/icons";
import { Card, EmptyState, Screen } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import { colors } from "@/theme/colors";

export default function RosterScreen() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);

  useEffect(() => {
    essService
      .me()
      .then((res) => setMe(res.data))
      .catch(() => undefined);
  }, []);

  return (
    <Screen
      scroll
      header={<AppHeader title="Roster" name={me?.display_name} />}
      contentStyle={styles.content}
    >
      <Card style={styles.card}>
        <EmptyState
          title="Roster coming soon"
          message="Your shift roster will appear here once HR publishes it to ESS. Until then, use Attendance for daily check-in."
          icon={<IconCalendar size={20} color={colors.primary} />}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/attendance")}
        >
          <Text style={styles.link}>Go to Attendance</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 32 },
  card: { gap: 16, padding: 20 },
  link: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});