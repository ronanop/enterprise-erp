import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconFingerprint } from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBox,
  FilterChips,
  Screen,
  SearchField,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance } from "@/types/api";
import { colors } from "@/theme/colors";
import {
  formatDisplayDateDDMMYYYY,
  formatHoursLabel,
  formatTime,
} from "@/utils/datetime";

const FILTERS = ["All", "Present", "Absent", "Late", "Overtime"];

export default function AttendanceHistoryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    essService
      .attendance()
      .then((res) => {
        setRows(res.data ?? []);
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load history",
        ),
      );
  }, []);

  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let ot = 0;
    for (const row of rows) {
      const status = row.attendance_status.toLowerCase();
      if (status.includes("present")) present += 1;
      if (isLate(row)) late += 1;
      const hours = Number(row.total_hours) || 0;
      if (hours > 8) ot += hours - 8;
    }
    return { total: rows.length, present, late, ot };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const status = row.attendance_status.toLowerCase();
      const q = query.trim().toLowerCase();
      if (q && !`${row.attendance_date} ${status}`.includes(q)) return false;
      if (filter === "Present") return status.includes("present");
      if (filter === "Absent") return status.includes("absent");
      if (filter === "Late") return isLate(row);
      if (filter === "Overtime") return Number(row.total_hours) > 8;
      return true;
    });
  }, [rows, query, filter]);

  return (
    <Screen scroll header={<SubHeader title="History" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by date or status..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Monthly Overview</Text>
        <View style={styles.stats}>
          <Stat label="Total Days" value={String(stats.total)} />
          <Stat label="Present" value={String(stats.present)} />
          <Stat label="Late" value={String(stats.late).padStart(2, "0")} />
          <Stat label="Overtime" value={`${stats.ot.toFixed(0)}h`} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Past Records</Text>
          <Pressable onPress={() => router.push("/(tabs)/attendance/correction")}>
            <Text style={styles.link}>Request correction</Text>
          </Pressable>
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            title="No records"
            description="Try another filter or date range."
            icon={<IconFingerprint size={20} color={colors.primary} />}
          />
        ) : (
          filtered.map((row) => {
            const hours = Number(row.total_hours) || 0;
            const overtime = hours > 8;
            const late = isLate(row);
            return (
              <Card key={row.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.date}>
                      {formatDisplayDateDDMMYYYY(row.attendance_date)}
                    </Text>
                    <Text style={styles.meta}>
                      {formatTime(row.check_in_at)} –{" "}
                      {formatTime(row.check_out_at)}
                    </Text>
                  </View>
                  <View style={styles.badges}>
                    <Text style={styles.status}>{row.attendance_status}</Text>
                    {late ? <Text style={styles.lateBadge}>Late</Text> : null}
                    {overtime ? (
                      <Text style={styles.otBadge}>OT</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.rowFooter}>
                  <Text style={styles.hours}>
                    {formatHoursLabel(row.total_hours)}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/attendance/correction",
                        params: { date: row.attendance_date },
                      })
                    }
                  >
                    <Text style={styles.link}>Correct this day</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

function isLate(row: EssAttendance) {
  if (!row.check_in_at) return false;
  const hours = new Date(row.check_in_at).getHours();
  const minutes = new Date(row.check_in_at).getMinutes();
  return hours > 9 || (hours === 9 && minutes > 30);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  link: { fontSize: 14, fontWeight: "500", color: colors.primary },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", gap: 4 },
  statLabel: { fontSize: 12, color: colors.onSurfaceVariant },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.onSurface },
  row: { gap: 12 },
  rowTop: { flexDirection: "row", gap: 12 },
  date: { fontWeight: "700", color: colors.onSurface },
  meta: { marginTop: 4, fontSize: 12, color: colors.onSurfaceVariant },
  badges: { alignItems: "flex-end", gap: 4 },
  status: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
    color: colors.primary,
  },
  lateBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffdad6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
  },
  otBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.25)",
    paddingTop: 10,
  },
  hours: { fontSize: 12, color: colors.onSurfaceVariant },
});
