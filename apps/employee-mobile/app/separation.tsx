import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssSeparationItem } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, todayLocalDate } from "@/utils/datetime";

export default function SeparationScreen() {
  const [rows, setRows] = useState<EssSeparationItem[]>([]);
  const [lwd, setLwd] = useState(todayLocalDate());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const res = await essService.separation();
    setRows(res.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load separation",
        ),
      );
    }, [reload]),
  );

  async function onSubmit() {
    if (!lwd) {
      setError("Last working day is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createSeparation({
        separation_type: "resignation",
        requested_last_working_date: lwd,
        reason: reason || undefined,
      });
      setMessage("Resignation request created");
      setReason("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Separation" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <Card style={styles.form}>
        <Text style={styles.formTitle}>Request resignation</Text>
        <TextField
          label="Last working day (YYYY-MM-DD)"
          value={lwd}
          onChangeText={setLwd}
          autoCapitalize="none"
        />
        <TextField
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Optional"
        />
        <Button
          title="Submit request"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </Card>

      <Text style={styles.section}>My requests</Text>
      {rows.length === 0 ? (
        <EmptyState
          title="No separation requests"
          message="Submitted resignations will appear here."
        />
      ) : (
        rows.map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.title}>{r.document_number}</Text>
              <Text style={styles.badge}>{r.status}</Text>
            </View>
            <Text style={styles.meta}>
              {r.separation_type} · LWD{" "}
              {formatDisplayDateDDMMYYYY(r.requested_last_working_date)}
            </Text>
            {r.notice_status ? (
              <Text style={styles.meta}>Notice: {r.notice_status.replace(/_/g, " ")}</Text>
            ) : null}
            {r.fnf_status ? (
              <Text style={styles.meta}>FnF: {r.fnf_status}</Text>
            ) : null}
            {r.fnf_status === "pending" &&
            (r.notice_status === "served" ||
              r.notice_status === "direct_exit" ||
              r.notice_status === "not_served") ? (
              <Text style={styles.meta}>FNF is pending</Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  formTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  card: { gap: 4 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.primary,
  },
  meta: { fontSize: 12, color: colors.onSurfaceVariant, textTransform: "capitalize" },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
