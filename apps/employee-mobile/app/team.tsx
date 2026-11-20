import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconUsers } from "@/components/icons";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Screen,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssTeamMember } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_CARD, RADIUS_FULL } from "@/theme/tokens";

function statusLabel(status: string | null | undefined): string {
  if (!status) return "Active";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TeamScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [rows, setRows] = useState<EssTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isManager = Boolean(me?.is_manager || me?.can_approve_team_leave);

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    essService
      .teamMembers()
      .then((res) => {
        if (!cancelled) {
          setRows(res.data ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load team members",
          );
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isManager]);

  return (
  <Screen scroll header={<SubHeader title="My Team" />} contentStyle={styles.content}>
    <Text style={styles.lead}>People who report to you in HRMS.</Text>
    {error ? <ErrorBox>{error}</ErrorBox> : null}

    {!isManager ? (
      <EmptyState
        title="Manager access only"
        message="When HR assigns you as a manager with direct reports, your team directory appears here."
      />
    ) : loading ? (
      <EmptyState title="Loading team…" />
    ) : rows.length === 0 ? (
      <EmptyState
        title="No direct reports"
        message="When HR assigns employees under you, they will appear here."
      />
    ) : (
      rows.map((member) => (
        <Card key={member.employee_id} style={styles.memberCard}>
          <View style={styles.memberRow}>
            <Avatar name={member.display_name} size="md" />
            <View style={styles.memberCopy}>
              <View style={styles.memberTop}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {member.display_name}
                </Text>
                <StatusBadge status={statusLabel(member.status)} tone="success" />
              </View>
              <Text style={styles.memberMeta} numberOfLines={1}>
                {member.designation || "—"}
                {member.department_name ? ` · ${member.department_name}` : ""}
              </Text>
              <View style={styles.codePill}>
                <Text style={styles.codeText}>{member.employee_code}</Text>
              </View>
              <Text style={styles.contactLine} numberOfLines={1}>
                {member.email || "—"}
              </Text>
              <Text style={styles.contactLine}>{member.mobile || "—"}</Text>
            </View>
          </View>
        </Card>
      ))
    )}

    {isManager ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/approvals")}
        style={({ pressed }) => [
          styles.approvalsLink,
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <IconUsers size={18} color={colors.primary} />
        <Text style={styles.approvalsText}>Open team approvals</Text>
      </Pressable>
    ) : (
      <Button
        title="Back to home"
        variant="secondary"
        onPress={() => router.push("/(tabs)/home")}
      />
    )}
  </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12, paddingBottom: 32 },
  lead: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  memberCard: { padding: 14 },
  memberRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  memberCopy: { flex: 1, minWidth: 0, gap: 4 },
  memberTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  memberMeta: { fontSize: 12, fontWeight: "500", color: colors.onSurfaceVariant },
  codePill: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  contactLine: { fontSize: 12, color: colors.onSurfaceVariant },
  approvalsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: RADIUS_CARD,
    backgroundColor: "#EEF2FF",
    paddingVertical: 14,
  },
  approvalsText: { fontSize: 14, fontWeight: "700", color: colors.primary },
});