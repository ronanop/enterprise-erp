import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconCalendar, IconLocation, IconUser } from "@/components/icons";
import { AlertBox, Avatar, Button, Card, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, HrmsProfile } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDateTime, formatDisplayDateDDMMYYYY } from "@/utils/datetime";

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function displayDate(value: string | null | undefined): string {
  return value ? formatDisplayDateDDMMYYYY(value) : "-";
}

export default function PersonalInformationScreen() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [hrms, setHrms] = useState<HrmsProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hrmsError, setHrmsError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      essService
        .me()
        .then((res) => {
          setMe(res.data);
          setError(null);
        })
        .catch((err) => setError(errorText(err, "Failed to load profile")));
      essService
        .hrmsProfile()
        .then((res) => {
          setHrms(res.data);
          setHrmsError(null);
        })
        .catch((err) => setHrmsError(errorText(err, "HRMS details unavailable")));
    }, []),
  );

  async function onSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await essService.refreshHrmsProfile();
      setHrms(res.data);
      setHrmsError(null);
      setMessage("Details synced from HRMS");
    } catch (err) {
      setHrmsError(errorText(err, "HRMS sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  const name = hrms?.display_name || me?.display_name || "";
  const designation = hrms?.designation || me?.designation || "-";
  const code = hrms?.employee_code || me?.employee_code || "-";

  return (
    <Screen
      scroll
      header={<SubHeader title="Personal Information" />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {hrmsError ? <AlertBox tone="warn">{hrmsError}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      {me || hrms ? (
        <>
          <View style={styles.hero}>
            <Avatar name={name} size="xl" ring />
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {designation} · ID: {code}
            </Text>
          </View>

          <InfoCard
            title="Bio Data"
            icon={<IconUser size={18} color={colors.primary} />}
            iconBackground={colors.primaryFixed}
          >
            <InfoRow label="Date of Birth" value={displayDate(hrms?.date_of_birth)} />
            <InfoRow label="Gender" value={hrms?.gender || "-"} />
            <InfoRow label="Status" value={hrms?.status || me?.status || "-"} />
          </InfoCard>

          <InfoCard
            title="Employment"
            icon={<IconCalendar size={18} color={colors.secondary} />}
            iconBackground="#eaddff"
          >
            <InfoRow label="Company" value={hrms?.company || "-"} />
            <InfoRow label="Department" value={hrms?.department || me?.department_name || "-"} />
            <InfoRow label="Manager" value={hrms?.manager || me?.manager_name || "-"} />
            <InfoRow label="Employment Type" value={hrms?.employment_type || "-"} />
            <InfoRow
              label="Date of Joining"
              value={displayDate(hrms?.date_of_joining || me?.date_of_joining)}
            />
          </InfoCard>

          <InfoCard
            title="Work Location"
            icon={<IconLocation size={18} color={colors.tertiary} />}
            iconBackground="#d1fae5"
          >
            <InfoRow label="Branch" value={hrms?.branch || "-"} />
            <InfoRow label="Location" value={hrms?.work_location || "-"} />
          </InfoCard>

          <InfoCard
            title="Contact Channels"
            icon={<Text style={styles.atSign}>@</Text>}
            iconBackground="#d1fae5"
          >
            <ContactTile label="Work Email" value={hrms?.email || me?.email || ""} />
            <ContactTile label="Mobile" value={hrms?.mobile || me?.mobile || ""} />
          </InfoCard>

          {hrms && hrms.leave_balances.length > 0 ? (
            <InfoCard
              title="Leave Balances"
              icon={<IconCalendar size={18} color={colors.primary} />}
              iconBackground={colors.primaryFixed}
            >
              {hrms.leave_balances.map((b) => (
                <InfoRow
                  key={`${b.leave_type_code}-${b.year ?? ""}`}
                  label={b.leave_type_name || b.leave_type_code}
                  value={`${b.closing_balance} left · ${b.used} used`}
                />
              ))}
            </InfoCard>
          ) : null}

          <Button
            title={syncing ? "Syncing…" : "Sync from HRMS"}
            onPress={onSync}
            loading={syncing}
            disabled={syncing}
          />
          <Text style={styles.updated}>
            {hrms?.profile_fetched_at
              ? `Last synced ${formatDateTime(hrms.profile_fetched_at)}`
              : "Not synced from HRMS yet"}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

function InfoCard({
  title,
  icon,
  iconBackground,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBackground: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTitle}>
        <View style={[styles.iconTile, { backgroundColor: iconBackground }]}>{icon}</View>
        <Text style={styles.cardHeading}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ContactTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contactTile}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 32, gap: 20 },
  hero: { alignItems: "center", paddingTop: 4 },
  name: { marginTop: 16, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  meta: { marginTop: 4, fontSize: 14, color: colors.onSurfaceVariant },
  card: { gap: 12, padding: 16 },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconTile: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  cardHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
    paddingVertical: 10,
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.onSurfaceVariant },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
    textTransform: "capitalize",
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  atSign: { fontSize: 19, fontWeight: "700", color: "#047857" },
  contactTile: { gap: 4, borderRadius: 12, backgroundColor: colors.surfaceLow, padding: 12 },
  contactValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  updated: { textAlign: "center", fontSize: 12, color: colors.onSurfaceVariant },
});
