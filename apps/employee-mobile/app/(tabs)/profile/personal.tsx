import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconEdit, IconLocation, IconUser } from "@/components/icons";
import { AlertBox, Avatar, Button, Card, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";

export default function PersonalInformationScreen() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    }, []),
  );

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
              {me.designation || "—"} · ID: {me.employee_code}
            </Text>
          </View>

          <InfoCard
            title="Bio Data"
            icon={<IconUser size={18} color={colors.primary} />}
            iconBackground={colors.primaryFixed}
          >
            <InfoRow label="Date of Birth" value="June 12, 1994" />
            <InfoRow label="Gender" value="—" />
            <InfoRow label="Nationality" value="India" />
          </InfoCard>

          <InfoCard
            title="Residential"
            icon={<IconLocation size={18} color={colors.secondary} />}
            iconBackground="#eaddff"
          >
            <Text style={styles.fieldLabel}>Current Address</Text>
            <Text style={styles.address}>
              742 Evergreen Terrace, Bengaluru, KA 560001
            </Text>
            <View style={styles.mapPreview}>
              <IconLocation size={20} color={colors.primary} />
              <Text style={styles.mapText}>Map preview</Text>
            </View>
          </InfoCard>

          <InfoCard
            title="Contact Channels"
            icon={<Text style={styles.atSign}>@</Text>}
            iconBackground="#d1fae5"
          >
            <ContactTile label="Work Email" value={me.email} />
            <ContactTile label="Personal Mobile" value={me.mobile} />
          </InfoCard>

          <Button
            title="Request Detail Update"
            onPress={() => setMessage("Update request submitted for HR review")}
          />
          <Text style={styles.updated}>
            Last updated on {me.date_of_joining || "—"}
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
  rowValue: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "600", color: colors.onSurface },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  address: { marginTop: 4, fontSize: 15, fontWeight: "600", lineHeight: 21, color: colors.onSurface },
  mapPreview: {
    height: 112,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
  },
  mapText: { fontSize: 14, color: colors.onSurfaceVariant },
  atSign: { fontSize: 19, fontWeight: "700", color: "#047857" },
  contactTile: { gap: 4, borderRadius: 12, backgroundColor: colors.surfaceLow, padding: 12 },
  contactValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  updated: { textAlign: "center", fontSize: 12, color: colors.onSurfaceVariant },
});
