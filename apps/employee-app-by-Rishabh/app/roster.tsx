import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconCalendar } from "@/components/icons";
import { Card, EmptyState, FieldRow, Screen } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { HrmsProfile } from "@/types/api";
import { colors } from "@/theme/colors";

export default function RosterScreen() {
  const router = useRouter();
  const [hrms, setHrms] = useState<HrmsProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .hrmsProfile()
        .then((res) => setHrms(res.data))
        .catch(() => setHrms(null));
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Roster" />} contentStyle={styles.content}>
      {hrms ? (
        <Card style={styles.card}>
          <FieldRow label="Branch" value={hrms.branch} />
          <FieldRow label="Work location" value={hrms.work_location ?? ""} />
          <FieldRow label="Reporting manager" value={hrms.manager} />
        </Card>
      ) : null}
      <Card style={styles.card}>
        <EmptyState
          title="Roster coming soon"
          description="Your shift roster will appear here once HR publishes it to ESS. Until then, use Attendance for daily check-in."
          icon={<IconCalendar size={20} color={colors.primary} />}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/(tabs)/attendance")}
          hitSlop={8}
        >
          <Text style={styles.link}>Go to Attendance</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 12 },
  link: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    paddingVertical: 4,
  },
});
