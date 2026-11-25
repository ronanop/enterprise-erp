import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import {
  compareIsoDates,
  isIsoInRange,
  todayLocalDate,
  toIsoDate,
} from "@/utils/datetime";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type MonthCell = {
  day: number;
  iso: string | null;
  inMonth: boolean;
  isToday: boolean;
};

export function buildMonthGridMondayFirst(cursor: Date): {
  label: string;
  cells: MonthCell[];
} {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = todayLocalDate();

  const cells: MonthCell[] = [];
  for (let i = 0; i < startPad; i += 1) {
    const day = new Date(year, month, -startPad + i + 1);
    cells.push({
      day: day.getDate(),
      iso: toIsoDate(day),
      inMonth: false,
      isToday: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      iso,
      inMonth: true,
      isToday: iso === todayIso,
    });
  }
  while (cells.length % 7 !== 0) {
    const next = cells.length - startPad - daysInMonth + 1;
    const day = new Date(year, month + 1, next);
    cells.push({
      day: day.getDate(),
      iso: toIsoDate(day),
      inMonth: false,
      isToday: false,
    });
  }
  return { label, cells };
}

type Props = {
  cursor: Date;
  onCursorChange: (next: Date) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  maxDate?: string;
};

export function MonthRangeCalendar({
  cursor,
  onCursorChange,
  startDate,
  endDate,
  onRangeChange,
  maxDate,
}: Props) {
  const { label, cells } = useMemo(
    () => buildMonthGridMondayFirst(cursor),
    [cursor],
  );

  function onDayTap(iso: string | null) {
    if (!iso) return;
    if (maxDate && compareIsoDates(iso, maxDate) > 0) return;

    if (!startDate || (startDate && endDate)) {
      onRangeChange(iso, "");
      return;
    }
    if (compareIsoDates(iso, startDate) < 0) {
      onRangeChange(iso, startDate);
      return;
    }
    onRangeChange(startDate, iso);
  }

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() =>
            onCursorChange(
              new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
            )
          }
          style={styles.nav}
        >
          <Text style={styles.navGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() =>
            onCursorChange(
              new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
            )
          }
          style={styles.nav}
        >
          <Text style={styles.navGlyph}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          const iso = cell.iso;
          const disabled = Boolean(
            !iso || (maxDate && iso && compareIsoDates(iso, maxDate) > 0),
          );
          const inRange = Boolean(
            iso &&
              startDate &&
              endDate &&
              isIsoInRange(iso, startDate, endDate),
          );
          const isStart = Boolean(
            iso && startDate && iso === startDate.slice(0, 10),
          );
          const isEnd = Boolean(iso && endDate && iso === endDate.slice(0, 10));
          const isEdge = isStart || isEnd;

          return (
            <Pressable
              key={`${iso ?? "x"}-${index}`}
              disabled={disabled}
              onPress={() => onDayTap(iso)}
              style={[
                styles.day,
                !cell.inMonth ? styles.outMonth : null,
                disabled ? styles.disabled : null,
                inRange && !isEdge ? styles.inRange : null,
                isEdge ? styles.edge : null,
                cell.isToday && !isEdge && !inRange ? styles.today : null,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !cell.inMonth ? styles.outMonthText : null,
                  inRange && !isEdge ? styles.inRangeText : null,
                  isEdge ? styles.edgeText : null,
                ]}
              >
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nav: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.surfaceLow,
  },
  navGlyph: { fontSize: 22, lineHeight: 24, color: colors.primary, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  weekRow: { marginBottom: 4, flexDirection: "row" },
  weekday: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
  },
  dayText: { fontSize: 14, color: colors.onSurface },
  outMonth: {},
  outMonthText: { color: colors.outlineVariant },
  disabled: { opacity: 0.4 },
  inRange: { backgroundColor: colors.primaryFixed },
  inRangeText: { fontWeight: "600", color: colors.primary },
  edge: { backgroundColor: colors.primary },
  edgeText: { fontWeight: "700", color: "#ffffff" },
  today: { borderWidth: 2, borderColor: "rgba(0,74,198,0.4)" },
});
