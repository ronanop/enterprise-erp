import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconCalendar } from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBox,
  FilterChips,
  Screen,
  SearchField,
  StatusBadge,
  leaveStatusTone,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssLeaveRequest, EssLeaveType } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatLeaveRangeLine } from "@/utils/datetime";
import { leaveStatusDisplay } from "@/utils/leave-status";

const FILTERS = ["All", "Approved", "Pending", "Rejected"];

export default function LeaveHistoryScreen() {
  const router = useRouter();
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [rows, setRows] = useState<EssLeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  useFocusEffect(
    useCallback(() => {
      Promise.all([essService.leaveRequests(), essService.leaveTypes()])
        .then(([req, typ]) => {
          setRows(req.data ?? []);
          setTypes(typ.data ?? []);
          setError(null);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load leave history",
          ),
        );
    }, []),
  );

  const typeName = useCallback(
    (id: string) =>
      types.find((type) => type.id === id)?.leave_type_name ?? "Leave",
    [types],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const name = typeName(row.leave_type_id).toLowerCase();
      const status = row.status.toLowerCase();
      const q = query.trim().toLowerCase();
      if (q && !`${name} ${status} ${row.start_date}`.includes(q)) return false;
      if (filter === "Approved") return status === "approved";
      if (filter === "Pending") {
        return ["submitted", "draft", "pending"].includes(status);
      }
      if (filter === "Rejected") return status === "rejected";
      return true;
    });
  }, [rows, query, filter, typeName]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <Screen scroll header={<SubHeader title="Leave History" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search requests..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {groups.length === 0 ? (
        <EmptyState
          title="No leave history"
          description="Your requests will appear here."
          icon={<IconCalendar size={20} color={colors.primary} />}
        />
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.rows.map((row) => {
              const displayStatus = leaveStatusDisplay(row.status);
              const sick = typeName(row.leave_type_id)
                .toLowerCase()
                .includes("sick");
              return (
                <Pressable
                  key={row.id}
                  onPress={() => router.push(`/(tabs)/leave/${row.id}`)}
                >
                  <Card style={styles.row}>
                    <View
                      style={[
                        styles.icon,
                        sick ? styles.iconSick : styles.iconDefault,
                      ]}
                    >
                      <IconCalendar
                        size={18}
                        color={sick ? colors.error : colors.secondary}
                      />
                    </View>
                    <View style={styles.copy}>
                      <View style={styles.top}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.title}>
                            {typeName(row.leave_type_id)}
                          </Text>
                          <Text style={styles.doc}>{row.document_number}</Text>
                        </View>
                        <StatusBadge
                          status={displayStatus}
                          tone={leaveStatusTone(row.status)}
                          onLight
                        />
                      </View>
                      <View style={styles.footer}>
                        <Text style={styles.range}>
                          {formatLeaveRangeLine(row.start_date, row.end_date)}
                        </Text>
                        <Text style={styles.days}>
                          {row.days_count} Day
                          {Number(row.days_count) === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}

function groupByMonth(rows: EssLeaveRequest[]) {
  const map = new Map<string, EssLeaveRequest[]>();
  for (const row of rows) {
    const date = new Date(`${row.start_date}T12:00:00`);
    const label = date
      .toLocaleString(undefined, { month: "long", year: "numeric" })
      .toUpperCase();
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(row);
  }
  return [...map.entries()].map(([label, groupRows]) => ({
    label,
    rows: groupRows,
  }));
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  group: { gap: 8 },
  groupLabel: {
    paddingHorizontal: 2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconDefault: { backgroundColor: "#eaddff" },
  iconSick: { backgroundColor: "#ffdad6" },
  copy: { flex: 1 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  doc: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.25)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  range: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant },
  days: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
