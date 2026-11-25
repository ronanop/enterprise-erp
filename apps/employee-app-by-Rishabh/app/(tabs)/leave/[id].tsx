import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssLeaveRequest, EssLeaveType } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatLeaveRangeLine } from "@/utils/datetime";
import { leaveStatusColor, leaveStatusDisplay } from "@/utils/leave-status";

export default function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<EssLeaveRequest | null>(null);
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([essService.leaveRequest(id), essService.leaveTypes()])
      .then(([req, t]) => {
        setRow(req.data);
        setTypes(t.data ?? []);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load leave",
        ),
      );
  }, [id]);

  const typeName =
    types.find((t) => t.id === row?.leave_type_id)?.leave_type_name ?? "Leave";
  const canCancel =
    row &&
    ["draft", "submitted", "pending"].includes(row.status.toLowerCase());

  async function onCancel() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await essService.cancelLeaveRequest(id);
      setRow(res.data);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Cancel failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Leave detail" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.title}>{typeName}</Text>
          <Text
            style={[styles.status, { color: leaveStatusColor(row.status) }]}
          >
            {leaveStatusDisplay(row.status)}
          </Text>
          <Text style={styles.meta}>
            {formatLeaveRangeLine(row.start_date, row.end_date, row.days_count)}
          </Text>
          <Text style={styles.doc}>{row.document_number}</Text>
          {row.reason ? (
            <Text style={styles.reason}>Reason: {row.reason}</Text>
          ) : null}
          {canCancel ? (
            <Button
              title="Cancel request"
              variant="danger"
              loading={loading}
              onPress={() => void onCancel()}
            />
          ) : null}
          <Button
            title="Back to leave"
            variant="secondary"
            onPress={() => router.back()}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface },
  status: { fontWeight: "700", fontSize: 14 },
  meta: { fontSize: 14, color: colors.onSurfaceVariant },
  doc: { fontSize: 12, color: colors.outline },
  reason: { fontSize: 14, color: colors.onSurface },
});
