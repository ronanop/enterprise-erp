import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssTeamLeaveItem } from "@/types/api";
import { colors, radii } from "@/theme/colors";
import { formatLeaveRangeLine } from "@/utils/datetime";
import { leaveStatusColor, leaveStatusDisplay } from "@/utils/leave-status";

export default function TeamLeaveScreen() {
  const { me } = useAuth();
  const [rows, setRows] = useState<EssTeamLeaveItem[]>([]);
  const [query, setQuery] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isManager = Boolean(me?.is_manager || me?.can_approve_team_leave);

  const refresh = useCallback(async () => {
    const res = await essService.teamLeave();
    setRows(res.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isManager) return;
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load team leave",
        ),
      );
    }, [isManager, refresh]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.display_name} ${r.employee_code}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  if (!isManager) {
    return <Redirect href="/(tabs)/leave" />;
  }

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    setError(null);
    setMessage(null);
    try {
      if (action === "approve") await essService.managerApproveTeamLeave(id);
      else await essService.rejectTeamLeave(id);
      setMessage(action === "approve" ? "Approved" : "Rejected");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Team leave" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search team members…"
        placeholderTextColor="rgba(67,70,85,0.55)"
        style={styles.search}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No team leave"
          message="Nothing matches this filter."
        />
      ) : (
        filtered.map((row) => {
          const pending = ["draft", "submitted", "pending"].includes(
            row.status.toLowerCase(),
          );
          return (
            <Card key={row.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.name}>{row.display_name}</Text>
                <Text
                  style={{
                    color: leaveStatusColor(row.status),
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {leaveStatusDisplay(row.status)}
                </Text>
              </View>
              <Text style={styles.meta}>
                {row.employee_code} · {row.document_number}
              </Text>
              <Text style={styles.range}>
                {formatLeaveRangeLine(
                  row.start_date,
                  row.end_date,
                  row.days_count,
                )}
              </Text>
              {pending ? (
                <View style={styles.actions}>
                  <Button
                    title="Approve"
                    loading={acting === row.id}
                    onPress={() => void act(row.id, "approve")}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Reject"
                    variant="danger"
                    disabled={acting === row.id}
                    onPress={() => void act(row.id, "reject")}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  search: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  card: { gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  range: { fontSize: 13, color: colors.onSurface },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
