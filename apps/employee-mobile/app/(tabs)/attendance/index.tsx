import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { AppHeader } from "@/components/AppHeader";
import {
  AttendancePunchSheet,
  type PunchConfirmPayload,
} from "@/components/AttendancePunchSheet";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconHouse,
  IconLocation,
  IconLogin,
  IconLogout,
  IconPlane,
  IconWallet,
} from "@/components/icons";
import {
  fetchLiveLocationLabel,
  formatOfficeLabel,
} from "@/lib/live-location";
import { AlertBox, Button, Card, ErrorBox, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssAttendance,
  EssAttendanceSummary,
  EssPunchPolicy,
} from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import {
  formatHmsSince,
  formatHours,
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

const DAILY_GOAL_H = 8;
const RING_SIZE = 160;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const ATTENDANCE_ACTIONS = [
  {
    href: "/(tabs)/attendance/wfh" as const,
    title: "Work From Home",
    subtitle: "Request remote work",
    Icon: IconHouse,
    iconBg: "#F3E8FF",
    iconFg: "#7C3AED",
  },
  {
    href: "/(tabs)/attendance/on-duty" as const,
    title: "On Duty",
    subtitle: "Official duty request",
    Icon: IconCalendar,
    iconBg: "#DCFCE7",
    iconFg: "#16A34A",
  },
  {
    href: "/(tabs)/attendance/on-tour" as const,
    title: "On Tour",
    subtitle: "Business travel request",
    Icon: IconPlane,
    iconBg: "#FFEDD5",
    iconFg: "#EA580C",
  },
  {
    href: "/(tabs)/attendance/correction" as const,
    title: "Regularization",
    subtitle: "Correct missing punch",
    Icon: IconClock,
    iconBg: "#FFEDD5",
    iconFg: "#EA580C",
  },
  {
    href: "/(tabs)/attendance/compoff" as const,
    title: "Comp Off",
    subtitle: "Request comp off",
    Icon: IconWallet,
    iconBg: "#FEE2E2",
    iconFg: "#DC2626",
  },
] as const;

function attendanceDayKey(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function findTodayRow(
  rows: EssAttendance[],
  day: string,
): EssAttendance | undefined {
  return rows.find((row) => attendanceDayKey(row.attendance_date) === day);
}

function upsertTodayRow(
  rows: EssAttendance[],
  next: EssAttendance,
): EssAttendance[] {
  const key = attendanceDayKey(next.attendance_date);
  const idx = rows.findIndex((r) => attendanceDayKey(r.attendance_date) === key);
  if (idx < 0) return [next, ...rows];
  const copy = rows.slice();
  copy[idx] = next;
  return copy;
}

export default function AttendanceScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [summary, setSummary] = useState<EssAttendanceSummary | null>(null);
  const [policy, setPolicy] = useState<EssPunchPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState("00:00:00");
  const [showSuccess, setShowSuccess] = useState(false);
  const [punchSheet, setPunchSheet] = useState<"in" | "out" | null>(null);
  const [officeLabel, setOfficeLabel] = useState("Office");

  const refresh = useCallback(async () => {
    const monthKey = todayLocalDate().slice(0, 7);
    const [att, sum, pol] = await Promise.all([
      essService.attendance(),
      essService.attendanceSummary(monthKey),
      essService.punchPolicy(),
    ]);
    setRows(att.data ?? []);
    setSummary(sum.data);
    setPolicy(pol.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load attendance",
        ),
      );
    }, [refresh]),
  );

  useEffect(() => {
    let cancelled = false;
    const locations = policy?.work_locations ?? [];
    const homeOfficeName = policy?.home_office_name ?? null;
    (async () => {
      const label = await fetchLiveLocationLabel({
        workLocations: locations,
        homeOfficeName,
      });
      if (cancelled) return;
      if (label) {
        setOfficeLabel(label);
        return;
      }
      setOfficeLabel(
        homeOfficeName
          ? formatOfficeLabel(homeOfficeName)
          : locations[0]?.location_name
            ? formatOfficeLabel(locations[0].location_name)
            : "Office",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [policy]);

  const todayStr = todayLocalDate();
  const today = findTodayRow(rows, todayStr);
  const done = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at);
  const isOut = punchedIn && !done;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setTimer(formatHmsSince(today.check_in_at));
      } else if (today?.total_hours != null) {
        setTimer(`${formatHours(today.total_hours)}:00`);
      } else {
        setTimer("00:00:00");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at, today?.total_hours]);

  async function runPunch(_kind: "in" | "out", payload: PunchConfirmPayload) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await essService.punch({
        image_base64: payload.imageBase64,
        ...(payload.latitude != null ? { latitude: payload.latitude } : {}),
        ...(payload.longitude != null ? { longitude: payload.longitude } : {}),
      });
      const action = res.data?.action;
      const attendance = res.data?.attendance;
      const hours = attendance?.total_hours;

      if (attendance) {
        setRows((prev) => upsertTodayRow(prev, attendance));
      }

      if (action === "check_in") {
        setMessage(
          payload.locationLabel
            ? `Checked in at ${payload.locationLabel}`
            : "Checked in successfully",
        );
        setShowSuccess(true);
      } else {
        setMessage(
          hours != null
            ? `Checked out · total ${formatHours(hours)}`
            : "Checked out successfully",
        );
      }
      setPunchSheet(null);
      void refresh().catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Punch failed");
    } finally {
      setLoading(false);
    }
  }

  function openPunchSheet(kind: "in" | "out") {
    if ((kind === "in" && punchedIn) || (kind === "out" && !isOut)) return;
    setPunchSheet(kind);
  }

  const worked =
    isOut && today?.check_in_at
      ? hoursBetween(today.check_in_at)
      : Number(today?.total_hours ?? 0);
  const workedProgress = Math.min(1, Math.max(0, worked / DAILY_GOAL_H));
  const lateDays = summary?.late_days ?? 0;
  const overtimeH = (summary?.total_overtime_minutes ?? 0) / 60;
  const firstName = me?.display_name?.split(/\s+/)[0] ?? "there";
  const calendar = useMemo(() => buildMonthGrid(todayStr), [todayStr]);

  if (showSuccess && today?.check_in_at && !today.check_out_at) {
    return (
      <Screen
        tabClearance
        banner={<OfflineBanner />}
        header={<AppHeader name={me?.display_name} />}
        contentStyle={styles.successScreen}
      >
        <View style={styles.successContent}>
          <View style={styles.successCheck}>
            <IconCheck size={64} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>Check-In Successful!</Text>
          <Text style={styles.successCopy}>
            Great to see you today. You are now officially clocked in.
          </Text>
          <Card style={styles.fact}>
            <View style={styles.factIcon}>
              <IconLocation size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.factLabel}>Location Verified</Text>
              <Text style={styles.factValue}>{officeLabel}</Text>
            </View>
          </Card>
          <Card style={styles.fact}>
            <View style={styles.factIcon}>
              <IconClock size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.factLabel}>Arrival Time</Text>
              <Text style={styles.factValue}>{formatTime(today.check_in_at)}</Text>
            </View>
          </Card>
          <Card style={styles.activeSession}>
            <View style={styles.activeSessionRow}>
              <View style={styles.activeDotCopy}>
                <View style={styles.activeDot} />
                <Text style={styles.activeTitle}>Active Session</Text>
              </View>
              <Text style={styles.activeTimer}>{timer}</Text>
            </View>
          </Card>
          <Button
            title="View Today's Schedule"
            icon={<IconChevronRight size={18} color="#ffffff" />}
            onPress={() => setShowSuccess(false)}
            style={{ width: "100%", marginTop: 8 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      tabClearance
      banner={<OfflineBanner />}
      header={<AppHeader title="Attendance" name={me?.display_name} />}
      contentStyle={styles.content}
    >

      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message && !showSuccess ? <AlertBox tone="success">{message}</AlertBox> : null}

      {/* Web order: punch hero → stats → actions → calendar → report link */}
      <Card style={styles.hero}>
        <View style={styles.ring}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={styles.ringSvg}
            accessible={false}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#e5eeff"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#2563eb"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - workedProgress)}
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.ringCopy}>
            <Text style={styles.ringValue}>{formatHours(worked)}</Text>
            <Text style={styles.ringLabel}>Hrs Worked</Text>
          </View>
        </View>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>
            {greetingForNow()}, {firstName}
          </Text>
          <View style={styles.locationRow}>
            <IconLocation size={14} color="#004ac6" />
            <Text style={styles.meta}>{officeLabel}</Text>
            {punchedIn ? (
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.punchButtons}>
          <Button
            title="Check In"
            icon={<IconLogin size={18} color="#ffffff" />}
            loading={loading && !isOut}
            disabled={punchedIn}
            onPress={() => openPunchSheet("in")}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8 }}
          />
          <Button
            title="Check Out"
            icon={<IconLogout size={18} color={colors.primary} />}
            variant="punchOut"
            loading={loading && isOut}
            disabled={!isOut}
            onPress={() => openPunchSheet("out")}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8 }}
          />
        </View>
        {policy?.geofence_required ? (
          <Text style={styles.hint}>Location required for punch</Text>
        ) : null}
      </Card>

      <AttendancePunchSheet
        open={punchSheet !== null}
        kind={punchSheet ?? "in"}
        policy={policy}
        loading={loading}
        onClose={() => {
          if (!loading) setPunchSheet(null);
        }}
        onConfirm={(payload) => void runPunch(punchSheet ?? "in", payload)}
      />

      <View style={styles.statGrid}>
        <Metric
          icon={<IconClock size={20} color="#712ae2" />}
          label="Overtime"
          value={overtimeH > 0 ? `${overtimeH.toFixed(1)}h` : "0h"}
          track="#eaddff"
          accent="#712ae2"
          pct={overtimeH * 20}
          hint={
            overtimeH > 0
              ? `+${Math.round((overtimeH / DAILY_GOAL_H) * 100)}%`
              : undefined
          }
        />
        <Metric
          icon={<IconAlert size={20} color="#ba1a1a" />}
          label="Late Days"
          value={String(lateDays)}
          track="#d3e4fe"
          accent="#2563eb"
          pct={lateDays === 0 ? 100 : 40}
          hint={lateDays === 0 ? "Perfect" : "This month"}
        />
      </View>

      <View style={styles.actionGrid}>
        {ATTENDANCE_ACTIONS.map((action) => (
          <Pressable
            key={action.href}
            style={({ pressed }) => [
              styles.actionCard,
              pressed && { opacity: 0.96, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => router.push(action.href)}
          >
            <View
              style={[styles.actionIcon, { backgroundColor: action.iconBg }]}
            >
              <action.Icon size={20} color={action.iconFg} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle} numberOfLines={1}>
                {action.title}
              </Text>
              <Text style={styles.actionSubtitle} numberOfLines={2}>
                {action.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Card style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>{calendar.label}</Text>
          <IconCalendar size={18} color="#64748B" />
        </View>
        <View style={styles.weekdays}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.days}>
          {calendar.cells.map((cell, index) => {
            const row = cell.iso ? findTodayRow(rows, cell.iso) : undefined;
            const isToday = cell.iso === todayStr;
            const state = (row?.attendance_status ?? "").toLowerCase();
            const isLeave =
              state.includes("leave") ||
              state === "on_leave" ||
              state === "half_day";
            const isAbsent = state.includes("absent");
            const isWfh =
              state.includes("work_from_home") || state.includes("wfh");
            const isPresent =
              !isLeave &&
              !isAbsent &&
              (state.includes("present") ||
                state === "late" ||
                Boolean(row?.check_in_at));

            // Today stays blue; other days get a full status circle.
            let circleBg: string | undefined;
            let textColor: string | undefined;
            if (isToday) {
              circleBg = "#2563eb";
              textColor = "#ffffff";
            } else if (isLeave) {
              circleBg = "#F59E0B";
              textColor = "#ffffff";
            } else if (isAbsent) {
              circleBg = "#EF4444";
              textColor = "#ffffff";
            } else if (isPresent) {
              circleBg = "#10B981";
              textColor = "#ffffff";
            } else if (isWfh) {
              circleBg = "#712ae2";
              textColor = "#ffffff";
            }

            return (
              <View key={`${cell.iso ?? "x"}-${index}`} style={styles.dayCell}>
                {cell.day ? (
                  <View
                    style={[
                      styles.day,
                      circleBg ? { backgroundColor: circleBg } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        textColor ? { color: textColor, fontWeight: "700" } : null,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {isToday ? <View style={styles.todayDot} /> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.legendText}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.legendText}>Leave</Text>
          </View>
        </View>
      </Card>

      <Pressable
        onPress={() => router.push("/(tabs)/attendance/history")}
        style={styles.reportWrap}
      >
        <Text style={styles.reportLink}>View Full Attendance Report</Text>
      </Pressable>
    </Screen>
  );
}

function Metric({
  icon,
  label,
  value,
  track,
  accent,
  pct,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  track: string;
  accent: string;
  pct: number;
  hint?: string;
}) {
  return (
    <Card style={styles.metric}>
      <View style={styles.metricTop}>
        {icon}
        {hint ? <Text style={[styles.metricHint, { color: hint === "Perfect" ? colors.success : colors.secondary }]}>{hint}</Text> : null}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={[styles.metricTrack, { backgroundColor: track }]}>
        <View style={[styles.metricFill, { width: `${Math.min(100, pct)}%` as `${number}%`, backgroundColor: accent }]} />
      </View>
    </Card>
  );
}

function buildMonthGrid(todayIso: string) {
  const base = new Date(`${todayIso}T12:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const label = base.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const startPadding = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startPadding; i += 1) cells.push({ day: null, iso: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
  return { label, cells };
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32, gap: 24 },
  hero: { alignItems: "center", gap: 20, padding: 24 },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { position: "absolute" },
  ringCopy: { alignItems: "center" },
  ringValue: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0b1c30",
    fontVariant: ["tabular-nums"],
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#434655",
  },
  greetingBlock: { width: "100%", alignItems: "center", gap: 8 },
  greeting: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0b1c30",
    textAlign: "center",
  },
  locationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  meta: { fontSize: 14, color: "#434655" },
  hint: { fontSize: 12, color: "#434655" },
  verifiedPill: {
    borderRadius: RADIUS_FULL,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#065f46",
  },
  punchButtons: { width: "100%", flexDirection: "row", gap: 12 },
  punchBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,28,48,0.4)",
    padding: 16,
  },
  punchSheet: {
    gap: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
  },
  punchTitle: { fontSize: 20, fontWeight: "700", color: "#0b1c30" },
  punchCopy: { fontSize: 14, lineHeight: 20, color: "#434655" },
  punchActions: { flexDirection: "row", gap: 12 },
  statGrid: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, gap: 4, padding: 16 },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: { marginTop: 8, fontSize: 14, color: "#434655" },
  metricValue: { fontSize: 24, fontWeight: "700", color: "#0b1c30" },
  metricHint: {
    borderRadius: RADIUS_FULL,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
    overflow: "hidden",
  },
  metricTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: RADIUS_FULL,
    marginTop: 12,
  },
  metricFill: { height: "100%", borderRadius: RADIUS_FULL },
  calendarCard: { padding: 20, gap: 8, overflow: "hidden" },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calendarTitle: { fontSize: 15, fontWeight: "600", color: "#0b1c30" },
  weekdays: { flexDirection: "row", marginBottom: 8 },
  weekday: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#434655",
  },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  dayCell: {
    width: "13.5%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: RADIUS_FULL,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 14, color: "#0b1c30" },
  todayDot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: RADIUS_FULL,
    backgroundColor: "#ffffff",
  },
  legend: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS_FULL },
  legendText: { fontSize: 12, color: "#434655" },
  reportWrap: { paddingBottom: 8, alignItems: "center" },
  reportLink: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#004ac6",
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS_FULL,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0b1c30",
  },
  actionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: "#64748B",
  },
  successScreen: { justifyContent: "center" },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 24, gap: 12 },
  successCheck: { width: 128, height: 128, marginBottom: 12, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, backgroundColor: colors.success },
  successTitle: { fontSize: 28, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  successCopy: { maxWidth: 280, textAlign: "center", fontSize: 16, lineHeight: 22, color: colors.onSurfaceVariant },
  fact: { width: "100%", flexDirection: "row", alignItems: "center", gap: 16 },
  factIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.surfaceHigh },
  factLabel: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },
  factValue: { marginTop: 2, fontSize: 18, fontWeight: "600", color: colors.onSurface },
  activeSession: { width: "100%", backgroundColor: "rgba(37,99,235,0.05)", borderColor: "rgba(0,74,198,0.1)" },
  activeSessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeDotCopy: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: RADIUS_FULL, backgroundColor: colors.success },
  activeTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  activeTimer: { fontSize: 24, fontWeight: "700", color: colors.primary, fontVariant: ["tabular-nums"] },
});
