import { useCallback, useState, type ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useFocusEffect, useRouter } from "expo-router";
import { NotificationBell } from "@/components/AppHeader";
import { CacheBrandLogo } from "@/components/CacheBrandLogo";
import {
  IconBank,
  IconBriefcase,
  IconCalendar,
  IconChevronRight,
  IconDocument,
  IconDoorExit,
  IconEdit,
  IconHelp,
  IconLaptop,
  IconLogout,
  IconUser,
  IconUsers,
  type IconProps,
} from "@/components/icons";
import {
  AlertBox,
  Avatar,
  Card,
  Screen,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";
import { GUTTER, HEADER_HEIGHT, RADIUS_CARD, RADIUS_FULL } from "@/theme/tokens";
import { parseIsoDate } from "@/utils/datetime";

type MoreLink = {
  label: string;
  description: string;
  href: string;
  Icon: ComponentType<IconProps>;
  iconBg: string;
  iconFg: string;
};

/** Mirrors PWA `PROFILE_LINKS` on profile/page.tsx */
const PROFILE_LINKS: MoreLink[] = [
  {
    label: "Personal Details",
    description: "View and update your personal information",
    href: "/(tabs)/profile/personal",
    Icon: IconUser,
    iconBg: "#dbeafe",
    iconFg: "#2563eb",
  },
  {
    label: "Emergency Contact",
    description: "Manage your emergency contact details",
    href: "/(tabs)/profile/emergency",
    Icon: IconUsers,
    iconBg: "#fee2e2",
    iconFg: "#dc2626",
  },
  {
    label: "Bank Details",
    description: "View and update your bank information",
    href: "/(tabs)/profile/bank",
    Icon: IconBank,
    iconBg: "#ccfbf1",
    iconFg: "#0d9488",
  },
  {
    label: "Company Assets",
    description: "Check your assigned company assets",
    href: "/assets",
    Icon: IconLaptop,
    iconBg: "#ffedd5",
    iconFg: "#ea580c",
  },
  {
    label: "My Documents",
    description: "View and manage your documents",
    href: "/documents",
    Icon: IconDocument,
    iconBg: "#ede9fe",
    iconFg: "#7c3aed",
  },
  {
    label: "Offboarding Request",
    description: "Raise your offboarding request",
    href: "/separation",
    Icon: IconDoorExit,
    iconBg: "#fce7f3",
    iconFg: "#db2777",
  },
];

function ProfileCardWave() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 360 220"
      preserveAspectRatio="none"
      aria-hidden
    >
      <Defs>
        <LinearGradient id="profileWaveGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#c7d7ff" stopOpacity={0.55} />
          <Stop offset="55%" stopColor="#dde7ff" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#f0f4ff" stopOpacity={0.15} />
        </LinearGradient>
      </Defs>
      <Path
        d="M0 48c42 28 78-22 128-8 52 14 78 52 132 40 36-8 64-28 100-18v158H0V48z"
        fill="url(#profileWaveGrad)"
      />
      <Path
        d="M0 88c48 22 86-18 136-6 54 14 86 46 140 32 34-8 58-26 84-16v122H0V88z"
        fill="#dbe5ff"
        opacity={0.45}
      />
      <Path
        d="M0 128c56 18 96-14 148-4 50 10 78 36 128 24 28-6 52-20 84-10v82H0v-92z"
        fill="#e8efff"
        opacity={0.55}
      />
    </Svg>
  );
}

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseIsoDate(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "Active";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function display(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "—";
}

export default function ProfileScreen() {
  const router = useRouter();
  const { me, signOut } = useAuth();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      essService
        .notificationUnreadCount()
        .then((res) => setUnread(res.data?.unread_count ?? 0))
        .catch(() => setUnread(0));
    }, []),
  );

  const isActive = (me?.status ?? "active").toLowerCase() === "active";

  return (
    <Screen
      scroll
      tabClearance
      header={
        <View style={styles.brandHeader}>
          <CacheBrandLogo height={38} />
          <NotificationBell count={unread} />
        </View>
      }
      contentStyle={styles.content}
    >
      {!me ? <AlertBox>Failed to load profile</AlertBox> : null}

      {me ? (
        <>
          <Card style={styles.heroCard}>
            <ProfileCardWave />
            <View style={styles.heroInner}>
              <View style={styles.avatarBlock}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/(tabs)/profile/personal")}
                >
                  <Avatar
                    name={me.display_name}
                    size="xl"
                    ring
                    photoUrl={me.photo_url}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  onPress={() => router.push("/(tabs)/profile/personal")}
                  style={styles.editBadge}
                >
                  <IconEdit size={14} color="#ffffff" />
                </Pressable>
              </View>

              <View
                style={[
                  styles.statusPill,
                  isActive ? styles.statusPillActive : styles.statusPillIdle,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    isActive ? styles.statusDotActive : styles.statusDotIdle,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    isActive ? styles.statusTextActive : styles.statusTextIdle,
                  ]}
                >
                  {statusLabel(me.status)}
                </Text>
              </View>

              <Text style={styles.name}>{me.display_name}</Text>
              <View style={styles.idPill}>
                <Text style={styles.idText}>{me.employee_code}</Text>
              </View>
              <Text style={styles.designation}>{me.designation || "—"}</Text>

              <View style={styles.orgGrid}>
                <InfoCell
                  Icon={IconBriefcase}
                  label="Department"
                  value={display(me.department_name)}
                />
                <InfoCell
                  Icon={IconUser}
                  label="Manager"
                  value={display(me.manager_name)}
                />
                <InfoCell
                  Icon={IconDocument}
                  label="Email"
                  value={display(me.email)}
                />
                <InfoCell
                  Icon={IconHelp}
                  label="Phone"
                  value={display(me.mobile)}
                />
                <InfoCell
                  Icon={IconCalendar}
                  label="Date of Birth"
                  value={formatLongDate(me.date_of_birth)}
                />
                <InfoCell
                  Icon={IconCalendar}
                  label="Date of Joining"
                  value={formatLongDate(me.date_of_joining)}
                />
              </View>
            </View>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>More</Text>
            {PROFILE_LINKS.map((item) => (
              <Pressable
                key={item.href}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.href as never)}
                style={({ pressed }) => [
                  styles.moreTile,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View
                  style={[styles.moreIcon, { backgroundColor: item.iconBg }]}
                >
                  <item.Icon size={20} color={item.iconFg} />
                </View>
                <View style={styles.moreCopy}>
                  <Text style={styles.moreLabel}>{item.label}</Text>
                  <Text style={styles.moreDesc}>{item.description}</Text>
                </View>
                <IconChevronRight size={18} color="#c3c6d7" />
              </Pressable>
            ))}
          </View>

          {me.is_ess_admin && me.admin_use_web_portal ? (
            <View style={styles.adminCard}>
              <Text style={styles.adminTitle}>HR / admin access</Text>
              <Text style={styles.adminCopy}>
                Your account has admin permissions. Use the HRMS web portal for
                configuration, bulk operations, and helpdesk agent tools.
              </Text>
              <Text style={styles.adminMeta}>
                Role: {me.ess_role ?? "admin"} ·{" "}
                {me.role_codes?.join(", ") || "—"}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.logoutBtn,
          pressed ? styles.pressed : null,
        ]}
      >
        <IconLogout size={18} color="#ba1a1a" />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
      <Text style={styles.version}>Version 2.4.1 (2024.11)</Text>
    </Screen>
  );
}

function InfoCell({
  Icon,
  label,
  value,
}: {
  Icon: ComponentType<IconProps>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoCell}>
      <View style={styles.infoLabelRow}>
        <Icon size={13} color="#9aa0b4" />
        <Text style={styles.infoCellLabel}>{label}</Text>
      </View>
      <Text style={styles.infoCellValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 20 },
  brandHeader: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.25)",
    backgroundColor: "rgba(248,249,255,0.9)",
  },
  pressed: { opacity: 0.75 },
  heroCard: {
    overflow: "hidden",
    padding: 0,
    borderRadius: 21.6,
    borderColor: "rgba(195,198,215,0.25)",
    shadowColor: "rgba(59,42,122,0.08)",
    shadowOpacity: 1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    backgroundColor: "#ffffff",
  },
  heroInner: {
    position: "relative",
    zIndex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 4,
    alignItems: "center",
  },
  avatarBlock: { position: "relative", alignSelf: "center" },
  editBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: "#2563eb",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    shadowColor: "#2563eb",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    borderRadius: RADIUS_FULL,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusPillActive: { backgroundColor: "#d1fae5" },
  statusPillIdle: { backgroundColor: "#eff4ff" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: "#10B981" },
  statusDotIdle: { backgroundColor: "#c3c6d7" },
  statusText: { fontSize: 11, fontWeight: "600" },
  statusTextActive: { color: "#059669" },
  statusTextIdle: { color: "#434655" },
  name: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 25.6,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#3b2a7a",
  },
  designation: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    color: "#8b92a8",
  },
  idPill: {
    alignSelf: "center",
    marginTop: 8,
    borderRadius: RADIUS_FULL,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  idText: { fontSize: 12, fontWeight: "600", color: "#2563eb" },
  orgGrid: {
    alignSelf: "stretch",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.3)",
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 16,
  },
  infoCell: { width: "46%", minWidth: 120 },
  infoLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoCellLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9aa0b4",
  },
  infoCellValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#3b2a7a",
  },
  section: { gap: 10 },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: "#3b2a7a",
    paddingHorizontal: 2,
  },
  moreTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.25)",
    borderRadius: RADIUS_CARD,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  moreIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  moreCopy: { flex: 1, minWidth: 0 },
  moreLabel: { fontSize: 15, fontWeight: "600", color: "#3b2a7a" },
  moreDesc: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: "#8b92a8",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_CARD,
    backgroundColor: "#ffdad6",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#ba1a1a" },
  securityHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  manage: { fontSize: 14, fontWeight: "500", color: colors.primary },
  securityCard: { padding: 8, gap: 4 },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  securityIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryFixed,
  },
  securityCopy: { flex: 1 },
  securityTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  securitySub: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  switchTrack: {
    width: 48,
    height: 28,
    padding: 2,
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
  },
  switchOn: { backgroundColor: colors.primaryContainer, alignItems: "flex-end" },
  switchOff: { backgroundColor: colors.outlineVariant, alignItems: "flex-start" },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: RADIUS_FULL,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  adminCard: {
    borderWidth: 1,
    borderColor: colors.primaryFixed,
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.surfaceLow,
    padding: 16,
    gap: 4,
  },
  adminTitle: { fontSize: 14, fontWeight: "600", color: colors.primary },
  adminCopy: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  adminMeta: { marginTop: 4, fontSize: 12, color: colors.onSurfaceVariant },
  employmentLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.92,
    color: colors.onSurfaceVariant,
  },
  version: {
    paddingBottom: 8,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(67,70,85,0.7)",
  },
});