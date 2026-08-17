import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { QuickAction, quickToneColor } from "@/components/QuickAction";
import {
  IconCalendar,
  IconClock,
  IconFingerprint,
  IconHelp,
  IconHome,
  IconLocation,
  IconWallet,
} from "@/components/icons";
import { Card, ErrorBox, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_CARD, RADIUS_FULL, text } from "@/theme/tokens";
import {
  formatHmsSince,
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

const DAILY_GOAL_H = 8;

export default function HomeScreen() {
  const router = useRouter();
  const { me, status } = useAuth();
  const [today, setToday] = useState<EssAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState("00:00:00");
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(() => new Date());

  usePushRegistration(status === "signedIn");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [attRes, unreadRes] = await Promise.all([
        essService.attendance(),
        essService.notificationUnreadCount(),
      ]);
      const todayStr = todayLocalDate();
      setToday(
        (attRes.data ?? []).find((row) => row.attendance_date === todayStr) ??
          null,
      );
      setUnread(unreadRes.data?.unread_count ?? 0);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load home",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const punchDone = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at) && !punchDone;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setTimer(formatHmsSince(today.check_in_at));
      } else if (today?.check_in_at && today.check_out_at) {
        setTimer(
          formatHmsSince(
            today.check_in_at,
            new Date(today.check_out_at).getTime(),
          ),
        );
      } else {
        setTimer("00:00:00");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at]);

  const workedH =
    punchedIn && today?.check_in_at
      ? hoursBetween(today.check_in_at)
      : today?.total_hours != null
        ? Number(today.total_hours)
        : 0;
  const pct = Math.min(100, Math.round((workedH / DAILY_GOAL_H) * 100));
  const firstName = me?.display_name?.split(/\s+/)[0] ?? "there";
  const pending = me?.pending_approvals_count ?? 0;

  const dateLine = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLine = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Screen
      scroll
      tabClearance
      banner={<OfflineBanner />}
      header={<AppHeader name={me?.display_name} unreadCount={unread} />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {/* Greeting */}
      <View style={styles.section}>
        <View>
          <Text style={styles.greeting}>
            {greetingForNow(now)}, {firstName}
          </Text>
          <View style={styles.dateRow}>
            <Text style={text.muted}>{dateLine}</Text>
            <Text style={text.muted}>·</Text>
            <Text style={[text.muted, styles.mono]}>{timeLine}</Text>
          </View>
        </View>

        {me?.can_approve_team_leave || me?.is_manager ? (
          <Pressable onPress={() => router.push("/approvals")}>
            <Card style={styles.approvalCard}>
              <View style={styles.approvalCopy}>
                <Text style={styles.approvalTitle}>Team approvals</Text>
                <Text style={text.muted}>
                  Leave, on-duty, attendance corrections
                </Text>
              </View>
              {pending > 0 ? (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingText}>
                    {pending > 99 ? "99+" : pending}
                  </Text>
                </View>
              ) : (
                <Text style={styles.openLink}>Open</Text>
              )}
            </Card>
          </Pressable>
        ) : null}
      </View>

      {/* Current status */}
      <Card style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View style={styles.statusLeft}>
            <Text style={styles.eyebrow}>Current Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: punchedIn
                      ? colors.tertiaryContainer
                      : punchDone
                        ? colors.success
                        : colors.outlineVariant,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {punchDone
                  ? "Day complete"
                  : punchedIn
                    ? "Checked In"
                    : "Not checked in"}
              </Text>
            </View>
            <Text style={text.muted}>
              {today?.check_in_at
                ? `Since ${formatTime(today.check_in_at)}`
                : "Tap Check In when you arrive"}
            </Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={styles.workingLabel}>Working Hours</Text>
            <Text style={styles.timer}>{timer}</Text>
          </View>
        </View>

        <View style={styles.goalBlock}>
          <View style={styles.goalRow}>
            <Text style={styles.goalLabel}>Daily Goal: {DAILY_GOAL_H}h</Text>
            <Text style={styles.goalPct}>{pct}% Completed</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
        </View>
      </Card>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Quick Actions</Text>

        <View style={styles.grid}>
          <QuickAction
            label={punchDone ? "Attendance" : punchedIn ? "Check Out" : "Check In"}
            tone={punchDone ? "default" : "primary"}
            icon={
              <IconFingerprint
                size={28}
                color={quickToneColor(punchDone ? "default" : "primary")}
              />
            }
            onPress={() => router.push("/(tabs)/attendance")}
          />
          <QuickAction
            label="Apply Leave"
            tone="violet"
            icon={<IconCalendar size={28} color={quickToneColor("violet")} />}
            onPress={() => router.push("/(tabs)/leave")}
          />
          <QuickAction
            label="Payslip"
            tone="emerald"
            icon={<IconWallet size={28} color={quickToneColor("emerald")} />}
            onPress={() => router.push("/(tabs)/payslips")}
          />
          <QuickAction
            label="Correction"
            tone="amber"
            icon={<IconClock size={28} color={quickToneColor("amber")} />}
            onPress={() => router.push("/(tabs)/attendance/correction")}
          />
        </View>

        <View style={styles.grid}>
          <QuickAction
            label="WFH"
            icon={<IconHome size={28} color={quickToneColor("default")} />}
            onPress={() => router.push("/(tabs)/attendance/wfh")}
          />
          <QuickAction
            label="Meeting rooms"
            tone="violet"
            icon={<IconLocation size={28} color={quickToneColor("violet")} />}
            onPress={() => router.push("/rooms")}
          />
          <QuickAction
            label="Help"
            tone="amber"
            icon={<IconHelp size={28} color={quickToneColor("amber")} />}
            onPress={() => router.push("/support")}
          />
          <View style={styles.gridSpacer} />
        </View>
      </View>

      {/* Shortcuts */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>Quick shortcuts</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View announcements"
            onPress={() => router.push("/announcements")}
            hitSlop={8}
          >
            <Text style={styles.viewAll}>Announcements</Text>
          </Pressable>
        </View>

        <View>
          <TimelineItem
            active
            time={
              today?.check_in_at
                ? `${formatTime(today.check_in_at)} — now`
                : "Attendance"
            }
            title={
              punchedIn
                ? "Active work session"
                : punchDone
                  ? "Session complete"
                  : "Start your day"
            }
            subtitle={
              me?.designation
                ? `${me.designation} · Employee Portal`
                : "Office attendance"
            }
            onPress={() => router.push("/(tabs)/attendance")}
          />
          <TimelineItem
            soft
            time="Leave"
            title="Balances & requests"
            subtitle="Check balances and apply for leave"
            onPress={() => router.push("/(tabs)/leave")}
          />
          <TimelineItem
            soft
            last
            time="Salary"
            title="Latest payslips"
            subtitle="View and download salary documents"
            onPress={() => router.push("/(tabs)/payslips")}
          />
        </View>
      </View>
    </Screen>
  );
}

function TimelineItem({
  time,
  title,
  subtitle,
  active,
  soft,
  last,
  onPress,
}: {
  time: string;
  title: string;
  subtitle: string;
  active?: boolean;
  soft?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      disabled={!onPress}
      style={styles.timelineRow}
    >
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, active ? styles.timelineDotActive : null]} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={[styles.timelineBody, last ? null : styles.timelineGap]}>
        <Text style={[styles.timelineTime, active ? styles.timelineTimeActive : null]}>
          {time}
        </Text>
        <View style={[styles.timelineCard, soft ? styles.timelineCardSoft : styles.timelineCardSolid]}>
          <Text style={styles.timelineTitle}>{title}</Text>
          <Text style={styles.timelineSub}>{subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, gap: 32 },
  section: { gap: 12 },

  greeting: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
  dateRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  mono: { fontVariant: ["tabular-nums"] },

  approvalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  approvalCopy: { flex: 1, gap: 2 },
  approvalTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  pendingPill: {
    height: 32,
    minWidth: 32,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  pendingText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  openLink: { fontSize: 14, fontWeight: "600", color: colors.primary },

  statusCard: { gap: 16 },
  statusTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  statusLeft: { flex: 1, gap: 4 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.primary,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 20, fontWeight: "600", color: colors.onSurface },
  statusRight: { alignItems: "flex-end" },
  workingLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  timer: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },

  goalBlock: { gap: 8 },
  goalRow: { flexDirection: "row", justifyContent: "space-between" },
  goalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  goalPct: { fontSize: 12, fontWeight: "600", color: colors.onSurface },
  barTrack: {
    height: 8,
    width: "100%",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.surfaceHighest,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primary,
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.onSurface,
    paddingHorizontal: 4,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  viewAll: { fontSize: 14, fontWeight: "500", color: colors.primary },
  grid: { flexDirection: "row", gap: 10 },
  gridSpacer: { flex: 1 },

  timelineRow: { flexDirection: "row", gap: 16 },
  timelineRail: { alignItems: "center", width: 12 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.outlineVariant,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.primaryFixed,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  timelineLine: {
    marginTop: 4,
    width: 2,
    flex: 1,
    backgroundColor: "rgba(195,198,215,0.4)",
  },
  timelineBody: { flex: 1 },
  timelineGap: { paddingBottom: 24 },
  timelineTime: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  timelineTimeActive: { color: colors.primary },
  timelineCard: {
    width: "100%",
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    padding: 16,
  },
  timelineCardSoft: {
    borderColor: "rgba(195,198,215,0.15)",
    backgroundColor: colors.surfaceLow,
    opacity: 0.9,
  },
  timelineCardSolid: {
    borderColor: "rgba(195,198,215,0.25)",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  timelineTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  timelineSub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
});
