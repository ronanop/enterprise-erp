import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import {
  IconChevronRight,
  IconLogout,
  IconUser,
} from "@/components/icons";
import {
  AlertBox,
  Avatar,
  Button,
  Card,
  ErrorBox,
  FieldRow,
  Screen,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from "@/lib/biometric";
import { colors } from "@/theme/colors";
import { RADIUS_CARD, RADIUS_FULL, tokens } from "@/theme/tokens";

const PROFESSIONAL_LINKS = [
  { label: "Personal Information", href: "/(tabs)/profile/personal" as const },
  { label: "Emergency Contact", href: "/(tabs)/profile/emergency" as const },
  { label: "Bank Details", href: "/(tabs)/profile/bank" as const },
  { label: "Education & Skills", href: "/(tabs)/profile/education" as const },
  { label: "Company Assets", href: "/assets" as const },
  { label: "Meeting rooms", href: "/rooms" as const },
  { label: "Help & tickets", href: "/support" as const },
  { label: "My Training", href: "/training" as const },
  { label: "Performance", href: "/performance" as const },
  { label: "Separation", href: "/separation" as const },
  { label: "My Documents", href: "/documents" as const },
  { label: "Security Settings", href: "/(tabs)/profile/security" as const },
  {
    label: "Change password",
    href: "/(tabs)/profile/change-password" as const,
  },
  { label: "Policies", href: "/compliance" as const },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { me, signOut } = useAuth();
  const [bio, setBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const cap = await getBiometricCapability();
      setBioLabel(cap.label);
      setBioAvailable(cap.hardware && cap.enrolled);
      setBio(await isBiometricUnlockEnabled());
    })();
  }, []);

  async function onToggleBiometric(next: boolean) {
    setBioBusy(true);
    setBioError(null);
    try {
      if (next) {
        if (!bioAvailable) {
          setBioError(
            Platform.OS === "web"
              ? "Biometric unlock is not available on web."
              : `${bioLabel} is not set up on this device.`,
          );
          return;
        }
        const ok = await authenticateWithBiometrics(
          `Enable ${bioLabel} unlock`,
        );
        if (!ok) {
          setBioError("Could not verify biometrics.");
          return;
        }
      }
      await setBiometricUnlockEnabled(next);
      setBio(next);
    } catch {
      setBioError("Failed to update biometric unlock.");
    } finally {
      setBioBusy(false);
    }
  }

  return (
    <Screen
      scroll
      tabClearance
      header={<AppHeader name={me?.display_name} />}
      contentStyle={styles.content}
    >
      {!me ? <AlertBox>Failed to load profile</AlertBox> : null}
      {bioError ? <ErrorBox>{bioError}</ErrorBox> : null}

      {me ? (
        <>
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              <Avatar name={me.display_name} size="xl" ring />
            </View>
            <Text style={styles.name}>{me.display_name}</Text>
            <Text style={styles.designation}>{me.designation || "—"}</Text>
            <View style={styles.idPill}>
              <Text style={styles.idText}>ID: {me.employee_code}</Text>
            </View>
          </View>

          <View style={styles.doubleGrid}>
            <InfoCard
              label="Designation"
              value={me.designation || "—"}
            />
            <InfoCard
              label="Role"
              value={
                me.ess_role ||
                me.role_codes?.[0] ||
                (me.is_manager ? "Manager" : "Employee")
              }
            />
          </View>
          <InfoCard label="Email" value={me.email} />
          <InfoCard label="Phone" value={me.mobile} />

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Professional Details</Text>
            <View style={tokens.cardFlush}>
              {PROFESSIONAL_LINKS.map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => router.push(item.href as never)}
                  style={({ pressed }) => [
                    styles.professionalRow,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={tokens.iconTile}>
                    <IconUser size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.professionalLabel}>{item.label}</Text>
                  <IconChevronRight size={18} color={colors.outlineVariant} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.securityHeading}>
              <Text style={styles.sectionHeading}>Security</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage security settings"
                onPress={() => router.push("/(tabs)/profile/security")}
                hitSlop={8}
              >
                <Text style={styles.manage}>Manage</Text>
              </Pressable>
            </View>
            <Card style={styles.securityCard}>
              <SecuritySummary
                title={`${bioLabel} unlock`}
                subtitle={
                  bioAvailable
                    ? `Use ${bioLabel.toLowerCase()} to unlock the app`
                    : "Not available on this device"
                }
                on={bio}
                disabled={bioBusy || (!bioAvailable && !bio)}
                onChange={(next) => void onToggleBiometric(next)}
              />
            </Card>
          </View>

          {me.is_ess_admin && me.admin_use_web_portal ? (
            <View style={styles.adminCard}>
              <Text style={styles.adminTitle}>HR / admin access</Text>
              <Text style={styles.adminCopy}>
                Your account has admin permissions. Use the HRMS web portal
                for configuration, bulk operations, and helpdesk agent tools.
              </Text>
              <Text style={styles.adminMeta}>
                Role: {me.ess_role ?? "admin"} · {me.role_codes?.join(", ") || "—"}
              </Text>
            </View>
          ) : null}

          <View style={tokens.cardFlush}>
            <Text style={styles.employmentLabel}>Employment</Text>
            <FieldRow label="Joined" value={me.date_of_joining} />
            <FieldRow label="Designation" value={me.designation} />
            <FieldRow label="Status" value={me.status} />
          </View>
        </>
      ) : null}

      <Button
        title="Logout"
        variant="danger"
        icon={<IconLogout size={18} color={colors.error} />}
        onPress={() => void signOut()}
      />
      <Text style={styles.version}>Version 2.4.1 (2024.11)</Text>
    </Screen>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || "—"}
      </Text>
    </Card>
  );
}

function SecuritySummary({
  title,
  subtitle,
  on,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!on)}
      style={({ pressed }) => [styles.securityRow, pressed ? styles.pressed : null]}
    >
      <View style={styles.securityIcon}>
        <IconUser size={18} color={colors.primary} />
      </View>
      <View style={styles.securityCopy}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securitySub}>{subtitle}</Text>
      </View>
      <View style={[styles.switchTrack, on ? styles.switchOn : styles.switchOff]}>
        <View style={styles.switchThumb} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 20 },
  pressed: { opacity: 0.75 },
  hero: { alignItems: "center", paddingTop: 8 },
  avatarWrap: { position: "relative" },
  name: { marginTop: 16, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  designation: { marginTop: 4, fontSize: 14, color: colors.onSurfaceVariant },
  idPill: {
    marginTop: 12,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  idText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  doubleGrid: { flexDirection: "row", gap: 12 },
  infoCard: { flex: 1, gap: 4 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: "rgba(67,70,85,0.8)",
  },
  infoValue: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  section: { gap: 8 },
  sectionHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  professionalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  professionalLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.onSurface },
  securityHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  manage: { fontSize: 14, fontWeight: "500", color: colors.primary },
  securityCard: { padding: 8, gap: 4 },
  securityRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
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
