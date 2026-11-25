import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconClock } from "@/components/icons";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatHoursLabel, formatTime } from "@/utils/datetime";

export default function TimesheetScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      essService
        .attendance()
        .then((res) => {
          setRows(res.data ?? []);
          setError(null);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load timesheet",
          ),
        )
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Timesheet" />} contentStyle={styles.content}>
      <Text style={styles.intro}>
        Hours from your attendance punches. Full roster planning stays with HR.
      </Text>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {loading ? (
        <Text style={styles.intro}>Loading…</Text>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No timesheet entries"
          description="Check in from Attendance to start logging hours."
          icon={<IconClock size={20} color={colors.primary} />}
        />
      ) : (
        rows.slice(0, 31).map((row) => (
          <Card key={row.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.date}>{row.attendance_date}</Text>
              <Text style={styles.meta}>
                {formatTime(row.check_in_at)} – {formatTime(row.check_out_at)}
              </Text>
            </View>
            <Text style={styles.hours}>{formatHoursLabel(row.total_hours)}</Text>
          </Card>
        ))
      )}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/(tabs)/attendance/history")}
        hitSlop={8}
      >
        <Text style={styles.link}>Open attendance history</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  intro: { fontSize: 14, color: colors.onSurfaceVariant },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  date: { fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  hours: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  link: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    paddingVertical: 8,
  },
});
