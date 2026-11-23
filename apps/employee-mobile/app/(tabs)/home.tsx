import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { CacheBrandLogo } from "@/components/CacheBrandLogo";
import { NotificationBell } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDocument,
  IconGrid,
  IconHouse,
  IconLayers,
  IconLocation,
  IconMeetingRoom,
  IconPlane,
  IconPolicy,
  IconSun,
  IconUser,
  IconUsers,
  type IconProps,
} from "@/components/icons";
import { AlertBox } from "@/components/ui/AlertBox";
import { Avatar } from "@/components/ui/Avatar";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/auth-context";
import { DAILY_QUOTES, quoteIndexForDate } from "@/data/daily-quotes";
import { usePushRegistration } from "@/hooks/use-push-registration";
import {
  fetchLiveLocationLabel,
  type WorkLocationFence,
} from "@/lib/live-location";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssApprovalItem,
  EssAttendance,
  EssHolidayCalendar,
  EssMeetingBooking,
} from "@/types/api";
import {
  formatTime,
  greetingForNow,
  hoursBetween,
  todayLocalDate,
} from "@/utils/datetime";

type QuickActionDef = {
  href: string;
  label: string;
  Icon: (props: IconProps) => ReactElement;
  tile: string;
  border: string;
  glow: string;
  fg: string;
};

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    href: "/(tabs)/leave?apply=1",
    label: "Apply Leave",
    Icon: IconCalendar,
    tile: "#F6FCF8",
    border: "#B7E4C7",
    glow: "#BBF7D0",
    fg: "#16A34A",
  },
  {
    href: "/(tabs)/attendance/wfh",
    label: "WFH",
    Icon: IconHouse,
    tile: "#F9F7FF",
    border: "#D4C8F8",
    glow: "#DDD6FE",
    fg: "#7C3AED",
  },
  {
    href: "/(tabs)/attendance/on-duty",
    label: "On Duty",
    Icon: IconBriefcase,
    tile: "#FFF9F4",
    border: "#F5CFA8",
    glow: "#FED7AA",
    fg: "#EA580C",
  },
  {
    href: "/(tabs)/attendance/correction",
    label: "Correction",
    Icon: IconClock,
    tile: "#FFF7F8",
    border: "#F5B8C2",
    glow: "#FECDD3",
    fg: "#E11D48",
  },
  {
    href: "/(tabs)/payslips",
    label: "Payslip",
    Icon: IconDocument,
    tile: "#F6F9FF",
    border: "#B8CFF5",
    glow: "#BFDBFE",
    fg: "#2563EB",
  },
  {
    href: "/(tabs)/attendance/compoff",
    label: "Comp Off",
    Icon: IconLayers,
    tile: "#F8F6FF",
    border: "#D4C8F8",
    glow: "#DDD6FE",
    fg: "#7C3AED",
  },
  {
    href: "/rooms",
    label: "Meeting Rooms",
    Icon: IconMeetingRoom,
    tile: "#F5FAFD",
    border: "#A8D5F0",
    glow: "#BAE6FD",
    fg: "#0284C7",
  },
];

const MORE_TOGGLE = {
  tile: "#F5FBFA",
  border: "#A7E4D8",
  glow: "#99F6E4",
  fg: "#0D9488",
};

const MORE_ACTIONS: QuickActionDef[] = [
  {
    href: "/(tabs)/attendance/on-tour",
    label: "On Tour",
    Icon: IconPlane,
    tile: "#FFF9F4",
    border: "#F5CFA8",
    glow: "#FED7AA",
    fg: "#EA580C",
  },
  {
    href: "/compliance",
    label: "Policy",
    Icon: IconPolicy,
    tile: "#F8F6FF",
    border: "#D4C8F8",
    glow: "#DDD6FE",
    fg: "#7C3AED",
  },
];

const MANAGER_MORE_ACTIONS: QuickActionDef[] = [
  {
    href: "/team",
    label: "Team",
    Icon: IconUsers,
    tile: "#EEF2FF",
    border: "#C7D2FE",
    glow: "#BFDBFE",
    fg: "#004ac6",
  },
];

const MANAGER_QUICK_ACTION: QuickActionDef = {
  href: "/approvals",
  label: "Approvals",
  Icon: IconCheck,
  tile: "#EEF2FF",
  border: "#C7D2FE",
  glow: "#BFDBFE",
  fg: "#004ac6",
};

const PRIMARY_ACTION_SLOTS = 7;
/** Web: px-4 (16) gutters + gap-2 (8) × 3 between 4 columns */
const HOME_GUTTER = 16;
const QA_GAP = 8;
const QA_TILE_W =
  (Dimensions.get("window").width - HOME_GUTTER * 2 - QA_GAP * 3) / 4;

const APPROVAL_CATEGORY_LABEL: Record<EssApprovalItem["category"], string> = {
  leave: "Leave",
  on_duty: "On duty",
  compoff: "Comp off",
  attendance_correction: "Regularization",
  wfh: "WFH",
};

function formatWorkingDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "00h 00m";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatShiftDay(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayHolidayName(calendars: EssHolidayCalendar[]): string | null {
  const today = todayLocalDate();
  for (const cal of calendars) {
    const rows = Array.isArray(cal.holidays_json) ? cal.holidays_json : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
      const name = typeof row.name === "string" ? row.name : "";
      if (date === today && name) return name;
    }
  }
  return null;
}

function formatBookingTime12(t: string | null | undefined): string {
  if (!t) return "";
  const raw = String(t).slice(0, 5);
  const [hh, mm] = raw.split(":").map(Number);
  if (Number.isNaN(hh)) return raw;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")} ${period}`;
}

function formatBookingTimeLabel(b: EssMeetingBooking): string {
  const start = formatBookingTime12(b.start_time);
  if (start) return start;
  return "All Day";
}

function isActiveBooking(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "cancelled" && s !== "rejected";
}

export default function HomeScreen() {
  const router = useRouter();
  const { me, status } = useAuth();
  const [today, setToday] = useState<EssAttendance | null>(null);
  const [holidayName, setHolidayName] = useState<string | null>(null);
  const [todayMeetings, setTodayMeetings] = useState<EssMeetingBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [workedH, setWorkedH] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(() => quoteIndexForDate());
  const [liveLocation, setLiveLocation] = useState<string | null>(null);
  const [liveLocationLoading, setLiveLocationLoading] = useState(true);
  const [teamApprovals, setTeamApprovals] = useState<EssApprovalItem[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const isManager = Boolean(me?.can_approve_team_leave || me?.is_manager);

  usePushRegistration(status === "signedIn");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLiveLocationLoading(true);
    (async () => {
      let workLocations: WorkLocationFence[] = [];
      let homeOfficeName: string | null = null;
      try {
        const pol = await essService.punchPolicy();
        workLocations = (pol.data?.work_locations ?? []) as WorkLocationFence[];
        homeOfficeName = pol.data?.home_office_name ?? null;
        const quick =
          homeOfficeName?.trim() ||
          workLocations.find((loc) => loc.location_name?.trim())?.location_name ||
          null;
        if (!cancelled && quick) {
          setLiveLocation(quick);
          setLiveLocationLoading(false);
        }
      } catch {
        workLocations = [];
        homeOfficeName = null;
      }
      const label = await fetchLiveLocationLabel({
        workLocations,
        homeOfficeName,
      });
      if (cancelled) return;
      setLiveLocation(label);
      setLiveLocationLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const [attRes, holidayRes, bookingRes, unreadRes] = await Promise.all([
        essService.attendance(),
        essService.holidays().catch(() => ({ data: [] as EssHolidayCalendar[] })),
        essService
          .myMeetingBookings()
          .catch(() => ({ data: [] as EssMeetingBooking[] })),
        essService.notificationUnreadCount().catch(() => ({
          data: { unread_count: 0 },
        })),
      ]);
      const todayStr = todayLocalDate();
      setToday(
        (attRes.data ?? []).find(
          (row) => String(row.attendance_date).slice(0, 10) === todayStr,
        ) ?? null,
      );
      setHolidayName(todayHolidayName(holidayRes.data ?? []));
      const meetings = (bookingRes.data ?? [])
        .filter(
          (b) =>
            String(b.request_date).slice(0, 10) === todayStr &&
            isActiveBooking(b.status),
        )
        .sort((a, b) =>
          (a.start_time || "").localeCompare(b.start_time || ""),
        );
      setTodayMeetings(meetings);
      setUnread(unreadRes.data?.unread_count ?? 0);
      setError(null);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to load home";
      if (/company scope mismatch/i.test(message)) {
        setError(null);
        setToday(null);
        setTodayMeetings([]);
      } else {
        setError(message);
      }
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!me?.can_approve_team_leave) {
      setTeamApprovals([]);
      return;
    }
    let cancelled = false;
    essService
      .approvals()
      .then((res) => {
        if (cancelled) return;
        setTeamApprovals(
          (res.data ?? []).filter((row) => row.category !== "compoff"),
        );
      })
      .catch(() => {
        if (!cancelled) setTeamApprovals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [me?.can_approve_team_leave, me?.employee_id]);

  const punchDone = Boolean(today?.check_out_at);
  const punchedIn = Boolean(today?.check_in_at) && !punchDone;

  useEffect(() => {
    const tick = () => {
      if (today?.check_in_at && !today.check_out_at) {
        setWorkedH(hoursBetween(today.check_in_at));
      } else if (today?.check_in_at && today.check_out_at) {
        setWorkedH(
          hoursBetween(
            today.check_in_at,
            new Date(today.check_out_at).getTime(),
          ),
        );
      } else if (today?.total_hours != null) {
        setWorkedH(Number(today.total_hours) || 0);
      } else {
        setWorkedH(0);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today?.check_in_at, today?.check_out_at, today?.total_hours]);

  const fullName = me?.display_name?.trim() || "there";
  const greeting = greetingForNow(now);
  const checkInLabel = today?.check_in_at ? formatTime(today.check_in_at) : "--:--";
  const checkOutLabel = today?.check_out_at
    ? formatTime(today.check_out_at)
    : "--:--";

  const progressPct = useMemo(() => {
    if (!punchedIn && !punchDone) return 0;
    if (punchDone) return 100;
    return Math.min(92, Math.max(18, Math.round((workedH / 8) * 100)));
  }, [punchedIn, punchDone, workedH]);

  const punchSource = (today?.source || "").toLowerCase();
  const machinePunch =
    punchSource === "biometric" || punchSource === "device";
  const statusLabel = punchDone
    ? "Day complete"
    : punchedIn
      ? machinePunch
        ? "Checked in (machine)"
        : "You're Working"
      : "Not checked in";

  const primaryHref = "/(tabs)/attendance";
  const primaryLabel = punchDone
    ? "View Attendance"
    : punchedIn
      ? "Check Out"
      : "Check In";

  const { primaryActions, moreActions } = useMemo(() => {
    const candidates = isManager
      ? [
          MANAGER_QUICK_ACTION,
          ...QUICK_ACTIONS.filter((a) => a.href !== "/approvals"),
        ]
      : QUICK_ACTIONS;
    const primary = candidates.slice(0, PRIMARY_ACTION_SLOTS);
    const overflow = candidates.slice(PRIMARY_ACTION_SLOTS);
    const extras = [
      ...(isManager ? MANAGER_MORE_ACTIONS : []),
      ...MORE_ACTIONS,
      ...overflow,
    ].filter(
      (a, idx, arr) =>
        !primary.some((p) => p.href === a.href) &&
        arr.findIndex((x) => x.href === a.href) === idx,
    );
    return { primaryActions: primary, moreActions: extras };
  }, [isManager]);

  const gridActions = moreOpen
    ? [...primaryActions, ...moreActions]
    : primaryActions;

  const barWidthPct = punchDone
    ? 100
    : punchedIn || today?.check_in_at
      ? Math.min(Math.max(progressPct, 12), 50)
      : 0;

  return (
    <Screen
      scroll
      tabClearance
      banner={<OfflineBanner />}
      style={styles.screen}
      contentStyle={styles.content}
    >
      {/* Hero */}
      <View style={styles.heroWrap}>
        <View style={styles.heroImage} pointerEvents="none">
          <Image
            source={require("../../assets/images/home/hero-building-v2.jpg")}
            style={styles.heroImageInner}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={["#F7FAFD", "rgba(247,250,253,0.75)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.heroWashLeft}
          />
          <LinearGradient
            colors={["transparent", "#F7FAFD"]}
            style={styles.heroWashBottom}
          />
        </View>

        <View style={styles.heroContent}>
          <View style={styles.headerRow}>
            <CacheBrandLogo height={40} />
            <View style={styles.headerRight}>
              <View style={styles.bellWrap}>
                <NotificationBell count={unread} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile"
                onPress={() => router.push("/(tabs)/profile")}
              >
                <Avatar
                  name={me?.display_name ?? ""}
                  size="sm"
                  ring
                  photoUrl={me?.photo_url}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <AlertBox>{error}</AlertBox>
            </View>
          ) : null}

          <View style={styles.greetingBlock}>
            <Text style={styles.greetingLine}>{greeting},</Text>
            <Text style={styles.greetingLine}>
              {fullName}{" "}
              <Text style={styles.wave}>👋</Text>
            </Text>
            <Text style={styles.subGreeting}>
              {"Here's your day at a glance."}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <InfoChip
              Icon={IconUser}
              label={me?.employee_code || "—"}
              strong
            />
            <InfoChip
              Icon={IconUser}
              label={me?.designation || "Employee"}
              strong
            />
            <InfoChip
              Icon={IconLocation}
              label={
                liveLocation ||
                (liveLocationLoading
                  ? "Locating…"
                  : me?.branch_name || me?.company_name || "Office")
              }
              strong
            />
          </ScrollView>
        </View>
      </View>

      <View style={styles.body}>
        {/* Attendance card */}
        <View style={styles.attCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    punchedIn || punchDone ? "#12B76A" : "#94A3B8",
                },
              ]}
            />
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>
          <View style={styles.shiftRow}>
            <Text style={styles.shiftDate}>{formatShiftDay(now)}</Text>
            <Text style={styles.shiftTime}>Shift: 09:30 AM – 06:30 PM</Text>
          </View>

          <View style={styles.timelineBlock}>
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${barWidthPct}%` }]} />
              </View>
              <View style={styles.nodesRow}>
                <View
                  style={[
                    styles.nodeSm,
                    today?.check_in_at
                      ? styles.nodeFilled
                      : styles.nodeEmpty,
                  ]}
                />
                <View style={styles.sunNode}>
                  <IconSun size={14} color="#F59E0B" />
                </View>
                <View
                  style={[
                    styles.nodeSm,
                    punchDone ? styles.nodeFilled : styles.nodeEmpty,
                  ]}
                />
              </View>
            </View>

            <View style={styles.timesRow}>
              <View style={styles.timeColLeft}>
                <Text
                  style={[
                    styles.timeValueSm,
                    !today?.check_in_at && styles.timeMuted,
                  ]}
                >
                  {today?.check_in_at ? checkInLabel : "--:--"}
                </Text>
                <Text style={styles.timeCap}>Check In</Text>
              </View>
              <View style={styles.timeColCenter}>
                <Text style={styles.timeValueLg}>
                  {formatWorkingDuration(workedH)}
                </Text>
                <Text style={styles.timeCap}>Working</Text>
              </View>
              <View style={styles.timeColRight}>
                <Text
                  style={[
                    styles.timeValueSm,
                    !punchDone && styles.timeMuted,
                  ]}
                >
                  {checkOutLabel}
                </Text>
                <Text style={styles.timeCap}>Check Out</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(primaryHref)}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            <Text style={styles.primaryBtnArrow}>→</Text>
          </Pressable>
        </View>

        {/* Manager approvals */}
        {isManager ? (
          <View style={styles.mgrCard}>
            <View style={styles.mgrHead}>
              <View style={styles.mgrTitleRow}>
                <View style={styles.mgrIcon}>
                  <IconCheck size={16} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mgrTitle}>Team Approvals</Text>
                  <Text style={styles.mgrSub}>
                    Requests from people who report to you
                  </Text>
                </View>
              </View>
              <View style={styles.mgrBadge}>
                <Text style={styles.mgrBadgeText}>
                  {me?.pending_approvals_count ?? teamApprovals.length}
                </Text>
              </View>
            </View>

            {teamApprovals.length === 0 ? (
              <Text style={styles.mgrEmpty}>
                No pending team requests right now.
              </Text>
            ) : (
              <View style={styles.mgrList}>
                {teamApprovals.slice(0, 3).map((item) => (
                  <Pressable
                    key={`${item.category}:${item.id}`}
                    onPress={() => router.push("/approvals")}
                    style={styles.mgrRow}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mgrCat}>
                        {APPROVAL_CATEGORY_LABEL[item.category]}
                      </Text>
                      <Text style={styles.mgrName} numberOfLines={1}>
                        {item.display_name}
                      </Text>
                      <Text style={styles.mgrDetail} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    </View>
                    <IconChevronRight size={16} color="#94A3B8" />
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              onPress={() => router.push("/approvals")}
              style={({ pressed }) => [
                styles.mgrCta,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.mgrCtaText}>Open team inbox →</Text>
            </Pressable>
          </View>
        ) : null}

        <DailyQuoteBanner index={quoteIndex} onIndexChange={setQuoteIndex} />

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
            Quick Actions
          </Text>
          <View style={styles.qaGrid}>
            {gridActions.map((item) => (
              <Pressable
                key={item.href + item.label}
                onPress={() => router.push(item.href as never)}
                style={({ pressed }) => [
                  styles.qaTile,
                  {
                    width: QA_TILE_W,
                    backgroundColor: item.tile,
                    borderColor: item.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.qaIconWrap}>
                  <View
                    style={[styles.qaGlow, { backgroundColor: item.glow }]}
                  />
                  <item.Icon size={26} color={item.fg} filled />
                </View>
                <Text style={styles.qaLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setMoreOpen((o) => !o)}
              style={({ pressed }) => [
                styles.qaTile,
                {
                  width: QA_TILE_W,
                  backgroundColor: MORE_TOGGLE.tile,
                  borderColor: MORE_TOGGLE.border,
                },
                moreOpen && styles.qaMoreOpen,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.qaIconWrap}>
                <View
                  style={[styles.qaGlow, { backgroundColor: MORE_TOGGLE.glow }]}
                />
                <IconGrid size={26} color={MORE_TOGGLE.fg} filled />
              </View>
              <Text style={styles.qaLabel}>{moreOpen ? "Less" : "More"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Upcoming Today */}
        <View style={[styles.section, { paddingBottom: 4 }]}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
            Upcoming Today
          </Text>
          {todayMeetings.length === 0 && !holidayName ? (
            <View style={styles.emptyUpcoming}>
              <Text style={styles.emptyUpcomingText}>
                Nothing scheduled for today.
              </Text>
            </View>
          ) : (
            <View style={styles.upcomingCard}>
              {todayMeetings.map((b, idx) => (
                <UpcomingRow
                  key={b.id}
                  tone="purple"
                  Icon={IconMeetingRoom}
                  title={b.title || "Meeting"}
                  subtitle={[b.room_name, b.status.replace(/_/g, " ")]
                    .filter(Boolean)
                    .join(" · ")}
                  time={formatBookingTimeLabel(b)}
                  divided={
                    idx < todayMeetings.length - 1 || Boolean(holidayName)
                  }
                  onPress={() => router.push("/rooms")}
                />
              ))}
              {holidayName ? (
                <UpcomingRow
                  tone="green"
                  Icon={IconPlane}
                  title="Company Holiday"
                  subtitle={holidayName}
                  time="All Day"
                  onPress={() => router.push("/(tabs)/leave/holidays")}
                />
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

function DailyQuoteBanner({
  index,
  onIndexChange,
}: {
  index: number;
  onIndexChange: (next: number) => void;
}) {
  const touchX = useRef<number | null>(null);
  const paused = useRef(false);
  const quote = DAILY_QUOTES[index] ?? DAILY_QUOTES[0]!;

  function goNext() {
    onIndexChange((index + 1) % DAILY_QUOTES.length);
  }

  function goPrev() {
    onIndexChange((index - 1 + DAILY_QUOTES.length) % DAILY_QUOTES.length);
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (paused.current) return;
      onIndexChange((index + 1) % DAILY_QUOTES.length);
    }, 5500);
    return () => clearInterval(id);
  }, [index, onIndexChange]);

  return (
    <View style={styles.quoteSection}>
      <LinearGradient
        colors={["#EDE7FF", "#F3EEFF", "#E8F1FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.quoteCard}
      >
        <Pressable
          style={styles.quoteCopy}
          onPress={goNext}
          onPressIn={() => {
            paused.current = true;
          }}
          onPressOut={() => {
            setTimeout(() => {
              paused.current = false;
            }, 4000);
          }}
          onTouchStart={(e) => {
            paused.current = true;
            touchX.current = e.nativeEvent.pageX;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.nativeEvent.pageX;
            touchX.current = null;
            setTimeout(() => {
              paused.current = false;
            }, 4000);
            if (start == null) return;
            const delta = end - start;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) goNext();
            else goPrev();
          }}
        >
          <Text style={styles.quoteTitle}>{quote.title}</Text>
          <Text style={styles.quoteSub}>{quote.subtitle}</Text>
          <View style={styles.dots}>
            {DAILY_QUOTES.map((_, i) => (
              <View
                key={i}
                style={i === index ? styles.dotActive : styles.dotIdle}
              />
            ))}
          </View>
        </Pressable>
        <Image source={quote.image} style={styles.quoteImg} />
        <Pressable
          accessibilityLabel="Show next quote"
          onPress={goNext}
          style={styles.quoteNext}
          hitSlop={8}
        >
          <IconChevronRight size={18} color="#7B61FF" />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function InfoChip({
  Icon,
  label,
  strong = false,
}: {
  Icon: (props: IconProps) => ReactElement;
  label: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.chip}>
      <Icon size={13} color="#1A2B56" />
      <Text
        style={[styles.chipText, strong && styles.chipStrong]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function UpcomingRow({
  tone,
  Icon,
  title,
  subtitle,
  time,
  divided = false,
  onPress,
}: {
  tone: "purple" | "green";
  Icon: (props: IconProps) => ReactElement;
  title: string;
  subtitle: string;
  time: string;
  divided?: boolean;
  onPress: () => void;
}) {
  const wrap = tone === "purple" ? "#EEF2FF" : "#ECFDF5";
  const icon = tone === "purple" ? "#6366F1" : "#12B76A";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.upcomingRow, divided && styles.upcomingDivided]}
    >
      <View style={[styles.upcomingIcon, { backgroundColor: wrap }]}>
        <Icon size={18} color={icon} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.upcomingTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.upcomingSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={styles.upcomingTime}>{time}</Text>
    </Pressable>
  );
}

/** Soft lift like PWA CSS shadows; Android uses elevation + stronger border. */
const cardLift = Platform.select({
  ios: {
    shadowColor: "#1A2B56",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 } as const,
  },
  android: {
    elevation: 4,
  },
  default: {
    shadowColor: "#1A2B56",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 } as const,
    elevation: 3,
  },
});

const tileLift = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 } as const,
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 } as const,
    elevation: 2,
  },
});

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F5F8FC" },
  content: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },

  heroWrap: {
    position: "relative",
    minHeight: 250,
    marginBottom: 0,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    height: 300,
    overflow: "hidden",
  },
  heroImageInner: {
    // Approximate web object-position 92% 72%
    width: "140%",
    height: "140%",
    marginLeft: "-28%",
    marginTop: "-22%",
  },
  heroWashLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "55%",
  },
  heroWashBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
  },
  heroContent: {
    zIndex: 2,
    paddingHorizontal: HOME_GUTTER,
    paddingTop: 12,
    paddingBottom: 24,
    minHeight: 250,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.92)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1A2B56",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  errorWrap: { marginTop: 20, marginBottom: 12 },
  greetingBlock: { marginTop: 24, maxWidth: "85%" },
  greetingLine: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
    letterSpacing: -0.26,
    color: "#0B1C30",
  },
  wave: { fontSize: 24 },
  subGreeting: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    color: "#64748B",
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingBottom: 4,
    marginTop: 28,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 192,
    shadowColor: "#1A2B56",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1A2B56",
    maxWidth: 160,
    lineHeight: 12,
  },
  chipStrong: { fontWeight: "700" },

  body: {
    marginTop: -12,
    paddingHorizontal: HOME_GUTTER,
    gap: 16,
    paddingBottom: 32,
  },

  attCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5DEEA",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...cardLift,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A2B56",
  },
  shiftRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  shiftDate: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  shiftTime: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "right",
  },
  timelineBlock: { marginTop: 16 },
  barRow: { height: 28, justifyContent: "center" },
  barTrack: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E8EDF5",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#12B76A",
  },
  nodesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  nodeSm: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeFilled: { backgroundColor: "#12B76A" },
  nodeEmpty: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  sunNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F6D98A",
    backgroundColor: "#FFF8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  timesRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timeColLeft: { flex: 1, alignItems: "flex-start" },
  timeColCenter: { flex: 1, alignItems: "center" },
  timeColRight: { flex: 1, alignItems: "flex-end" },
  timeValueSm: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A2B56",
    fontVariant: ["tabular-nums"],
  },
  timeValueLg: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A2B56",
    fontVariant: ["tabular-nums"],
  },
  timeMuted: { color: "#94A3B8" },
  timeCap: { fontSize: 11, fontWeight: "500", color: "#64748B", marginTop: 2 },
  primaryBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1A2B56",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#1A2B56",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  primaryBtnArrow: { fontSize: 15, color: "#ffffff" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  mgrCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#B8C4F5",
    backgroundColor: "#F5F7FF",
    // Keep edges crisp; clip list rows with an inner border instead of overflow:hidden
    // so Android elevation is not cut off.
    ...cardLift,
    shadowColor: "#2563eb",
  },
  mgrHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  mgrTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  mgrIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#004ac6",
    alignItems: "center",
    justifyContent: "center",
  },
  mgrTitle: { fontSize: 15, fontWeight: "700", color: "#1A2B56" },
  mgrSub: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  mgrBadge: {
    borderRadius: 999,
    backgroundColor: "#004ac6",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mgrBadgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  mgrEmpty: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  mgrList: { borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  mgrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  mgrCat: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#004ac6",
  },
  mgrName: { fontSize: 13, fontWeight: "700", color: "#0b1c30" },
  mgrDetail: { fontSize: 12, color: "#64748B" },
  mgrCta: {
    marginHorizontal: 14,
    marginVertical: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#004ac6",
    alignItems: "center",
    justifyContent: "center",
  },
  mgrCtaText: { fontSize: 13, fontWeight: "700", color: "#ffffff" },

  quoteSection: { marginBottom: 20 },
  quoteCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.55)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Avoid overflow:"hidden" — it clips Android elevation under the card.
    ...cardLift,
    shadowColor: "#7B61FF",
    shadowOpacity: 0.16,
  },
  quoteCopy: { flex: 1, minWidth: 0 },
  quoteTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    color: "#1A2B56",
  },
  quoteSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#6B7280",
  },
  dots: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  dotActive: {
    width: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#7B61FF",
  },
  dotIdle: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#C4B5FD",
  },
  quoteImg: {
    width: 72,
    height: 68,
    borderRadius: 12,
  },
  quoteNext: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  section: { gap: 0 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#1A2B56" },
  sectionTitleSpaced: { marginBottom: 12 },
  qaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: QA_GAP,
  },
  qaTile: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 8,
    ...tileLift,
  },
  qaMoreOpen: {
    borderColor: "rgba(13,148,136,0.55)",
    borderWidth: 2,
  },
  qaIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  qaGlow: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 0.35,
  },
  qaLabel: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    letterSpacing: -0.2,
    textAlign: "center",
    color: "#1A2B56",
    paddingHorizontal: 2,
  },

  emptyUpcoming: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5DEEA",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    ...tileLift,
  },
  emptyUpcomingText: { fontSize: 13, color: "#64748B" },
  upcomingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5DEEA",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    ...tileLift,
  },
  upcomingRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  upcomingDivided: { borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: "#1A2B56" },
  upcomingSub: { fontSize: 12, color: "#64748B" },
  upcomingTime: { fontSize: 12, fontWeight: "600", color: "#64748B" },
});
