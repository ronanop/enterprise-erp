import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle } from "react-native-svg";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFingerprint,
  IconLocation,
  IconLogin,
  IconLogout,
} from "@/components/icons";
import { AlertBox, Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
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
  const [selfie, setSelfie] = useState<string | null>(null);

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

  const todayStr = todayLocalDate();
  const today = rows.find((r) => r.attendance_date === todayStr);
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

  async function runPunch(imageBase64: string | null) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await essService.punch({ image_base64: imageBase64 });
      const action = res.data?.action;
      const hours = res.data?.attendance?.total_hours;
      if (action === "check_in") {
        setMessage("Checked in successfully");
        setShowSuccess(true);
      } else {
        setMessage(
          hours != null
            ? `Checked out · total ${formatHours(hours)}`
            : "Checked out successfully",
        );
      }
      setPunchSheet(null);
      setSelfie(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Punch failed");
    } finally {
      setLoading(false);
    }
  }

  const needsSelfie = Boolean(
    policy?.selfie_required || policy?.face_at_punch_required,
  );

  async function captureSelfie() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required to capture a selfie.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setSelfie(result.assets[0].base64);
    }
  }

  function openPunchSheet(kind: "in" | "out") {
    if ((kind === "in" && punchedIn) || (kind === "out" && !isOut)) return;
    setSelfie(null);
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
              <Text style={styles.factValue}>HQ Office</Text>
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

      <View style={styles.headerLinks}>
        <Pressable onPress={() => router.push("/(tabs)/attendance/wfh")}>
          <Text style={styles.headerLink}>WFH</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/(tabs)/attendance/history")}>
          <Text style={styles.headerLink}>History</Text>
        </Pressable>
      </View>

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
              stroke={colors.surfaceContainer}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.primary}
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
          <Text style={styles.greeting}>{greetingForNow()}, {firstName}</Text>
          <View style={styles.locationRow}>
            <IconLocation size={14} color={colors.primary} />
            <Text style={styles.meta}>HQ Office</Text>
            {punchedIn ? <Text style={styles.verified}>Verified</Text> : null}
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
        {policy?.geofence_required ? <Text style={styles.hint}>Location required for punch</Text> : null}
      </Card>

      <Modal
        visible={punchSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPunchSheet(null)}
      >
        <View style={styles.punchBackdrop}>
          <View style={styles.punchSheet}>
            <Text style={styles.punchTitle}>
              {punchSheet === "in" ? "Check in" : "Check out"}
            </Text>
            <Text style={styles.punchCopy}>
              {needsSelfie
                ? policy?.face_at_punch_required
                  ? "Capture your face to verify identity."
                  : "Take a selfie for attendance."
                : `Confirm punch${policy?.geofence_required ? " at your work location" : ""}.`}
            </Text>
            {needsSelfie ? (
              <Button
                title={selfie ? "Selfie captured" : "Take selfie"}
                variant="secondary"
                onPress={() => void captureSelfie()}
              />
            ) : null}
            <View style={styles.punchActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setPunchSheet(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  punchSheet === "in" ? "Confirm check in" : "Confirm check out"
                }
                loading={loading}
                disabled={needsSelfie && !selfie}
                onPress={() => void runPunch(needsSelfie ? selfie : null)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.statGrid}>
        <Metric icon={<IconClock size={20} color={colors.secondary} />} label="Overtime" value={overtimeH > 0 ? `${overtimeH.toFixed(1)}h` : "0h"} track="#eaddff" accent={colors.secondary} pct={overtimeH * 20} hint={overtimeH > 0 ? `+${Math.round((overtimeH / DAILY_GOAL_H) * 100)}%` : undefined} />
        <Metric icon={<IconAlert size={20} color={colors.error} />} label="Late Days" value={String(lateDays)} track={colors.surfaceHighest} accent={colors.primaryContainer} pct={lateDays === 0 ? 100 : 40} hint={lateDays === 0 ? "Perfect" : "This month"} />
      </View>

      <Card style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>{calendar.label}</Text>
          <Text style={styles.calendarHint}>This month</Text>
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
            const row = cell.iso
              ? rows.find((entry) => entry.attendance_date === cell.iso)
              : undefined;
            const isToday = cell.iso === todayStr;
            const state = (row?.attendance_status ?? "").toLowerCase();
            const dotColor =
              state === "late"
                ? colors.error
                : state === "work_from_home"
                  ? colors.secondary
                  : state === "absent"
                    ? colors.outlineVariant
                    : row?.check_in_at
                      ? colors.success
                      : undefined;
            return (
              <View key={`${cell.iso ?? "x"}-${index}`} style={styles.dayCell}>
                {cell.day ? (
                  <View style={[styles.day, isToday ? styles.today : null]}>
                    <Text
                      style={[
                        styles.dayText,
                        isToday ? styles.todayText : null,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {isToday || dotColor ? (
                      <View
                        style={[
                          styles.dayDot,
                          {
                            backgroundColor: isToday ? "#ffffff" : dotColor,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.legendText}>WFH</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.recentCard}>
        <Text style={styles.sectionHeading}>Recent Activity</Text>
        {rows.length === 0 ? (
          <EmptyState
            title="No attendance yet"
            description="Your punches will show up here."
            icon={<IconFingerprint size={20} color={colors.primary} />}
          />
        ) : (
          rows.slice(0, 4).map((row) => (
            <View key={row.id} style={styles.activity}>
              <View style={styles.activityIcon}><IconClock size={18} color={colors.onSurfaceVariant} /></View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>Clock In — Office</Text>
                <Text style={styles.activityMeta}>{row.attendance_date}, {formatTime(row.check_in_at)}</Text>
              </View>
              <Text style={styles.activityVerified}>Verified</Text>
            </View>
          ))
        )}
        <Pressable onPress={() => router.push("/(tabs)/attendance/history")}>
          <Text style={styles.reportLink}>View Full Attendance Report</Text>
        </Pressable>
      </Card>

      <View style={styles.requests}>
        {[
          { label: "Correction", href: "/(tabs)/attendance/correction" as const },
          { label: "WFH", href: "/(tabs)/attendance/wfh" as const },
          { label: "On Duty", href: "/(tabs)/attendance/on-duty" as const },
          { label: "Comp Off", href: "/(tabs)/attendance/compoff" as const },
        ].map((item) => (
          <Pressable key={item.label} style={styles.requestPill} onPress={() => router.push(item.href)}>
            <Text style={styles.requestText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
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
  content: { paddingTop: 20, paddingBottom: 32, gap: 24 },
  headerLinks: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  headerLink: { fontSize: 14, fontWeight: "600", color: colors.primary },
  hero: { alignItems: "center", gap: 16, padding: 24 },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { position: "absolute" },
  ringCopy: { alignItems: "center" },
  ringValue: { fontSize: 30, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] },
  ringLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.onSurfaceVariant },
  greetingBlock: { alignItems: "center", gap: 8 },
  greeting: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 13, color: colors.onSurfaceVariant },
  hint: { fontSize: 12, color: colors.onSurfaceVariant },
  verified: { borderRadius: RADIUS_FULL, backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: "#065f46", overflow: "hidden" },
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
    backgroundColor: colors.surface,
    padding: 20,
  },
  punchTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  punchCopy: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  punchActions: { flexDirection: "row", gap: 12 },
  statGrid: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, gap: 4 },
  metricTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricLabel: { marginTop: 4, fontSize: 14, color: colors.onSurfaceVariant },
  metricValue: { fontSize: 24, fontWeight: "700", color: colors.onSurface },
  metricHint: { borderRadius: RADIUS_FULL, backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: "700", overflow: "hidden" },
  metricTrack: { height: 6, overflow: "hidden", borderRadius: RADIUS_FULL, marginTop: 8 },
  metricFill: { height: "100%", borderRadius: RADIUS_FULL },
  calendarCard: { padding: 20, gap: 8 },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  calendarTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  calendarHint: { fontSize: 12, color: colors.onSurfaceVariant },
  weekdays: { flexDirection: "row", marginBottom: 4 },
  weekday: { width: "14.28%", textAlign: "center", fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: colors.onSurfaceVariant },
  days: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", height: 36, alignItems: "center", justifyContent: "center" },
  day: { width: 36, height: 36, borderRadius: RADIUS_FULL, alignItems: "center", justifyContent: "center" },
  today: { backgroundColor: colors.primaryContainer },
  dayText: { fontSize: 14, color: colors.onSurface },
  todayText: { color: "#ffffff", fontWeight: "700" },
  dayDot: { position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: RADIUS_FULL },
  legend: { marginTop: 8, flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: RADIUS_FULL },
  legendText: { fontSize: 12, color: colors.onSurfaceVariant },
  recentCard: { gap: 12 },
  sectionHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  activity: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "rgba(195,198,215,0.2)", paddingTop: 12 },
  activityIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, backgroundColor: colors.surfaceLow },
  activityCopy: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  activityMeta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  activityVerified: { fontSize: 12, fontWeight: "600", color: colors.success },
  reportLink: { paddingTop: 4, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.primary },
  requests: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  requestPill: { width: "48%", borderRadius: 12, backgroundColor: colors.surfaceLow, paddingHorizontal: 12, paddingVertical: 12 },
  requestText: { fontSize: 13, fontWeight: "600", color: colors.primary },
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
