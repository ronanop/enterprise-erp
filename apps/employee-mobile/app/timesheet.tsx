import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { IconClock } from "@/components/icons";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssMe } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, formatHoursLabel, formatTime } from "@/utils/datetime";

export default function TimesheetScreen() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([essService.me(), essService.attendance()])
      .then(([meRes, attRes]) => {
        setMe(meRes.data);
        setRows(attRes.data ?? []);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load timesheet",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen
      scroll
      header={<AppHeader title="Timesheet" name={me?.display_name} />}
      contentStyle={styles.content}
    >
      <Text style={styles.lead}>
        Hours from your attendance punches. Full roster planning stays with HR.
      </Text>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {loading ? (
        <Text style={styles.lead}>Loading…</Text>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No timesheet entries"
          message="Check in from Attendance to start logging hours."
          icon={<IconClock size={20} color={colors.primary} />}
        />
      ) : (
        rows.slice(0, 31).map((row) => (
          <Card key={row.id} style={styles.rowCard}>
            <View style={styles.rowInner}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowDate}>
                  {formatDisplayDateDDMMYYYY(row.attendance_date)}
                </Text>
                <Text style={styles.rowTimes}>
                  {formatTime(row.check_in_at)} – {formatTime(row.check_out_at)}
                </Text>
              </View>
              <Text style={styles.hours}>
                {formatHoursLabel(row.total_hours)}
              </Text>
            </View>
          </Card>
        ))
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/attendance/history")}
      >
        <Text style={styles.link}>Open attendance history</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12, paddingBottom: 32 },
  lead: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  rowCard: { padding: 16 },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowCopy: { flex: 1 },
  rowDate: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  rowTimes: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  hours: { fontSize: 14, fontWeight: "700", color: colors.primary },
  link: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});