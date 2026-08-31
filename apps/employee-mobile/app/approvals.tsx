import { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Button, Card, EmptyState, ErrorBox, FilterChips, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssApprovalItem } from "@/types/api";
import { colors } from "@/theme/colors";

const CATEGORY_LABEL: Record<EssApprovalItem["category"], string> = {
  leave: "Leave",
  on_duty: "On duty",
  compoff: "Comp off",
  attendance_correction: "Attendance",
  wfh: "WFH",
};

export default function ApprovalsScreen() {
  const { me, refreshMe } = useAuth();
  const [rows, setRows] = useState<EssApprovalItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isManager = Boolean(me?.is_manager || me?.can_approve_team_leave);

  const load = useCallback(async () => {
    const res = await essService.approvals();
    setRows((res.data ?? []).filter((row) => row.category !== "compoff"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isManager) return;
      setLoading(true);
      load()
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, [isManager, load]),
  );

  const filters = useMemo(() => {
    const cats = new Set(rows.map((r) => CATEGORY_LABEL[r.category]));
    return ["All", ...Array.from(cats).sort()];
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "All") return rows;
    return rows.filter((r) => CATEGORY_LABEL[r.category] === filter);
  }, [rows, filter]);

  if (!isManager) {
    return <Redirect href="/(tabs)/home" />;
  }

  async function act(item: EssApprovalItem, action: "approve" | "reject") {
    const key = `${item.category}:${item.id}`;
    setActing(key);
    setError(null);
    setMessage(null);
    try {
      await essService.actOnApproval(item.category, item.id, action);
      setMessage(action === "approve" ? "Approved" : "Rejected");
      await load();
      await refreshMe();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <Screen scroll banner={<OfflineBanner />} header={<SubHeader title="Approvals" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <FilterChips options={filters} value={filter} onChange={setFilter} />

      {loading ? (
        <EmptyState title="Loading…" message="Fetching pending approvals" />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          message="You're all caught up."
        />
      ) : (
        visible.map((item) => {
          const key = `${item.category}:${item.id}`;
          return (
            <Card key={key} style={styles.card}>
              <Text style={styles.cat}>{CATEGORY_LABEL[item.category]}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.who}>
                {item.display_name} · {item.employee_code}
              </Text>
              <Text style={styles.detail}>{item.detail}</Text>
              <View style={styles.actions}>
                <Button
                  title="Approve"
                  loading={acting === key}
                  onPress={() => void act(item, "approve")}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  disabled={acting === key}
                  onPress={() => void act(item, "reject")}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 6 },
  cat: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.primary,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  who: { fontSize: 13, color: colors.onSurfaceVariant },
  detail: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
