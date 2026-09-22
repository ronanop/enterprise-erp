import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { buildMonthGridMondayFirst } from "@/components/MonthRangeCalendar";
import { ErrorBox, Screen, SearchField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssHolidayCalendar } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

type HolidayRow = {
  id: string;
  date: string;
  name: string;
  kind: "mandatory" | "optional";
  weekday: string;
};

function flattenHolidays(calendars: EssHolidayCalendar[]): HolidayRow[] {
  const rows: HolidayRow[] = [];
  for (const calendar of calendars) {
    if (String(calendar.status).toLowerCase() === "archived") continue;
    const json = calendar.holidays_json;
    const items = Array.isArray(json)
      ? json
      : json &&
          typeof json === "object" &&
          Array.isArray((json as { holidays?: unknown[] }).holidays)
        ? (json as { holidays: unknown[] }).holidays
        : [];

    for (const [index, holiday] of items.entries()) {
      if (!holiday || typeof holiday !== "object") continue;
      const entry = holiday as {
        date?: string;
        holiday_date?: string;
        name?: string;
        title?: string;
        kind?: string;
        holiday_type?: string;
      };
      const date = String(entry.date ?? entry.holiday_date ?? "").slice(0, 10);
      if (!date) continue;
      const parsed = new Date(`${date}T12:00:00`);
      const weekday = Number.isNaN(parsed.getTime())
        ? ""
        : parsed.toLocaleDateString(undefined, { weekday: "long" });
      const optional =
        String(entry.holiday_type ?? entry.kind ?? "").toLowerCase() ===
        "optional";
      rows.push({
        id: `${calendar.id}-${index}-${date}`,
        date,
        name: String(entry.title ?? entry.name ?? "Holiday"),
        weekday,
        kind: optional ? "optional" : "mandatory",
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export default function HolidaysScreen() {
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    essService
      .holidays()
      .then((res) => {
        setRows(flattenHolidays(res.data ?? []));
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load holidays",
        ),
      );
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, query]);
  const calendar = useMemo(() => buildMonthGridMondayFirst(cursor), [cursor]);
  const holidayDates = useMemo(
    () => new Set(rows.map((row) => row.date)),
    [rows],
  );

  return (
    <Screen header={<SubHeader title="Holidays" />} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={styles.wrap}>
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable
            accessibilityLabel="Previous month"
            onPress={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
              )
            }
            style={styles.monthNav}
          >
            <Text style={styles.monthNavText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{calendar.label}</Text>
          <Pressable
            accessibilityLabel="Next month"
            onPress={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
              )
            }
            style={styles.monthNav}
          >
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <Text key={day} style={styles.weekday}>{day}</Text>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {calendar.cells.map((cell, index) => {
            const marked = Boolean(cell.iso && holidayDates.has(cell.iso));
            const active = cell.iso === selected;
            return (
              <Pressable
                key={`${cell.iso ?? "x"}-${index}`}
                disabled={!cell.iso}
                onPress={() => setSelected(cell.iso)}
                style={[
                  styles.dayCell,
                  active ? styles.dayCellSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !cell.inMonth ? styles.outMonth : null,
                    active ? styles.dayTextSelected : null,
                  ]}
                >
                  {cell.day}
                </Text>
                {marked && !active ? <View style={styles.holidayDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.search}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search holidays..."
        />
      </View>
      {error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ErrorBox>{error}</ErrorBox>
        </View>
      ) : null}
      <FlatList
        data={
          selected
            ? filtered.filter((item) => item.date === selected)
            : filtered
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {selected ? "No holiday on this date." : "No holidays published."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dateCol}>
              <Text style={styles.date}>
                {formatDisplayDateDDMMYYYY(item.date)}
              </Text>
              {item.weekday ? (
                <Text style={styles.weekdayLabel}>{item.weekday}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text
                style={[
                  styles.kind,
                  item.kind === "optional" ? styles.optional : styles.mandatory,
                ]}
              >
                {item.kind}
              </Text>
            </View>
          </View>
        )}
      />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  calendarCard: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#0b1c30",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  calendarHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNav: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.surfaceLow,
  },
  monthNavText: { fontSize: 22, fontWeight: "700", color: colors.primary },
  monthTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  dayCellSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 14, color: colors.onSurface },
  dayTextSelected: { fontWeight: "700", color: "#ffffff" },
  outMonth: { color: colors.outlineVariant },
  holidayDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#f59e0b",
  },
  search: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 8 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.35)",
    alignItems: "center",
  },
  dateCol: { width: 96 },
  date: { fontWeight: "700", color: colors.primary, fontSize: 12 },
  weekdayLabel: { marginTop: 2, fontSize: 11, color: colors.onSurfaceVariant },
  name: { fontWeight: "600", color: colors.onSurface },
  kind: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  mandatory: { color: colors.primary },
  optional: { color: "#b45309" },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: colors.onSurfaceVariant,
  },
});
