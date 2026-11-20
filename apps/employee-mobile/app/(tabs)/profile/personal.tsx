import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconEdit, IconLocation, IconUser } from "@/components/icons";
import {
  AlertBox,
  Avatar,
  Button,
  Card,
  ErrorBox,
  Screen,
  TextField,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssProfileUpdateRequest } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

function display(value: string | null | undefined, fallback = "—"): string {
  const text = value?.trim();
  return text ? text : fallback;
}

function titleCase(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function PersonalInformationScreen() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<EssProfileUpdateRequest | null>(null);
  const [requests, setRequests] = useState<EssProfileUpdateRequest[]>([]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await essService.listDetailUpdateRequests();
      const rows = Array.isArray(res.data) ? res.data : [];
      setRequests(rows);
      setPending(rows.find((r) => r.status === "submitted") ?? null);
    } catch {
      /* non-blocking */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      essService
        .me()
        .then((res) => {
          setMe(res.data);
          setError(null);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load profile",
          ),
        );
      void loadRequests();
    }, [loadRequests]),
  );

  async function submitUpdateRequest() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await essService.createDetailUpdateRequest({
        notes: notes.trim() || undefined,
      });
      if (res.data) setPending(res.data);
      setNotes("");
      setMessage(
        res.message || "Update request submitted for HR review",
      );
      await loadRequests();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to submit update request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      scroll
      header={<SubHeader title="Personal Information" />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      {me ? (
        <>
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              <Avatar name={me.display_name} size="xl" ring />
              <View style={styles.editBadge}>
                <IconEdit size={14} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.name}>{me.display_name}</Text>
            <Text style={styles.meta}>
              {display(me.designation)} · ID: {me.employee_code}
            </Text>
          </View>

          <InfoCard
            title="Bio Data"
            icon={<IconUser size={18} color={colors.primary} />}
            iconBackground={colors.primaryFixed}
          >
            <InfoRow
              label="Date of Birth"
              value={
                me.date_of_birth
                  ? formatDisplayDateDDMMYYYY(me.date_of_birth)
                  : "—"
              }
            />
            <InfoRow label="Gender" value={display(titleCase(me.gender))} />
            <InfoRow
              label="Marital Status"
              value={display(titleCase(me.marital_status))}
            />
            <InfoRow
              label="Nationality"
              value={display(titleCase(me.nationality))}
            />
            <InfoRow label="Blood Group" value={display(me.blood_group)} />
            <InfoRow
              label="Date of Joining"
              value={formatDisplayDateDDMMYYYY(me.date_of_joining)}
            />
            <InfoRow label="Manager" value={display(me.manager_name)} />
          </InfoCard>

          <InfoCard
            title="Residential"
            icon={<IconLocation size={18} color={colors.secondary} />}
            iconBackground="#eaddff"
          >
            <Text style={styles.fieldLabel}>Current Address</Text>
            <Text style={styles.address}>{display(me.current_address)}</Text>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              Permanent Address
            </Text>
            <Text style={styles.address}>{display(me.permanent_address)}</Text>
          </InfoCard>

          <InfoCard
            title="Contact Channels"
            icon={<Text style={styles.atSign}>@</Text>}
            iconBackground="#d1fae5"
          >
            <ContactTile label="Work Email" value={me.email} />
            <ContactTile label="Personal Mobile" value={me.mobile} />
          </InfoCard>

          <Card style={styles.requestCard}>
            <Text style={styles.requestTitle}>Request Detail Update</Text>
            <Text style={styles.requestHint}>
              Tell HR what needs correcting. Your request appears in the HR
              Employee Requests inbox.
            </Text>
            {pending ? (
              <AlertBox tone="success">
                Request pending HR review
                {pending.notes ? ` — ${pending.notes}` : ""}.
              </AlertBox>
            ) : (
              <TextField
                multiline
                numberOfLines={4}
                placeholder="e.g. Update current address / mobile number…"
                value={notes}
                onChangeText={setNotes}
                maxLength={1000}
                style={styles.notesInput}
              />
            )}
            <Button
              title={
                submitting
                  ? "Submitting…"
                  : pending
                    ? "Awaiting HR"
                    : "Request Detail Update"
              }
              disabled={submitting || Boolean(pending)}
              onPress={() => void submitUpdateRequest()}
            />
          </Card>

          {requests.length > 0 ? (
            <Card style={styles.requestCard}>
              <Text style={styles.requestTitle}>Update requests</Text>
              {requests.map((row) => (
                <View key={row.id} style={styles.requestRow}>
                  <Text style={styles.requestStatus}>{row.status}</Text>
                  {row.notes ? (
                    <Text style={styles.requestNotes} numberOfLines={2}>
                      {row.notes}
                    </Text>
                  ) : null}
                  {row.created_at ? (
                    <Text style={styles.requestDate}>
                      {formatDisplayDateDDMMYYYY(row.created_at)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}

          <Text style={styles.updated}>
            Synced from HRMS · Joined{" "}
            {formatDisplayDateDDMMYYYY(me.date_of_joining)}
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
        <View style={[styles.iconTile, { backgroundColor: iconBackground }]}>
          {icon}
        </View>
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
      <Text style={styles.contactValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 32, gap: 20 },
  hero: { alignItems: "center", paddingTop: 4 },
  avatarWrap: { position: "relative" },
  editBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryContainer,
  },
  name: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "700",
    color: colors.onSurface,
  },
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
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  address: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    color: colors.onSurface,
  },
  atSign: { fontSize: 19, fontWeight: "700", color: "#047857" },
  contactTile: {
    gap: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    padding: 12,
  },
  contactValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  requestCard: { gap: 12, padding: 16 },
  requestTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  requestHint: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
  notesInput: { minHeight: 88, textAlignVertical: "top" },
  requestRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.25)",
    paddingTop: 10,
    gap: 2,
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "capitalize",
  },
  requestNotes: { fontSize: 13, color: colors.onSurface },
  requestDate: { fontSize: 11, color: colors.onSurfaceVariant },
  updated: { textAlign: "center", fontSize: 12, color: colors.onSurfaceVariant },
});