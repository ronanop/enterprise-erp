import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssWfhRequest } from "@/types/api";
import { colors, radii } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, todayLocalDate } from "@/utils/datetime";
import { leaveStatusColor, leaveStatusDisplay } from "@/utils/leave-status";

const PORTIONS = [
  { id: "full_day", label: "Full day" },
  { id: "first_half", label: "First half" },
  { id: "second_half", label: "Second half" },
];

export default function WfhScreen() {
  const [rows, setRows] = useState<EssWfhRequest[]>([]);
  const [wfhDate, setWfhDate] = useState(todayLocalDate());
  const [endDate, setEndDate] = useState("");
  const [portion, setPortion] = useState("full_day");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = await essService.listWfh();
    setRows(list.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load WFH",
        ),
      );
    }, [refresh]),
  );

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createWfh({
        wfh_date: wfhDate,
        end_date: endDate || undefined,
        portion,
        reason: reason || undefined,
      });
      setMessage("WFH request submitted for manager approval");
      setReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Work From Home" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <Card style={styles.form}>
        <Text style={styles.help}>
          Request WFH for manager approval. After approval you can punch without
          office geofence.
        </Text>
        <TextField
          label="WFH date (YYYY-MM-DD)"
          value={wfhDate}
          onChangeText={setWfhDate}
          autoCapitalize="none"
        />
        <TextField
          label="End date optional (YYYY-MM-DD)"
          value={endDate}
          onChangeText={setEndDate}
          autoCapitalize="none"
          placeholder="Leave blank for single day"
        />
        <Text style={styles.label}>Portion</Text>
        <View style={styles.chips}>
          {PORTIONS.map((p) => (
            <Button
              key={p.id}
              title={p.label}
              variant={portion === p.id ? "primary" : "secondary"}
              onPress={() => setPortion(p.id)}
              style={styles.chipBtn}
            />
          ))}
        </View>
        <TextField
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Optional"
        />
        <Button title="Submit WFH" loading={loading} onPress={() => void onSubmit()} />
      </Card>

      <Text style={styles.section}>My requests</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No WFH requests yet.</Text>
      ) : (
        rows.map((row) => (
          <Card key={row.id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>
                {formatDisplayDateDDMMYYYY(row.wfh_date)}
                {row.end_date
                  ? ` → ${formatDisplayDateDDMMYYYY(row.end_date)}`
                  : ""}
              </Text>
              <Text style={{ color: leaveStatusColor(row.status), fontWeight: "700" }}>
                {leaveStatusDisplay(row.status)}
              </Text>
            </View>
            <Text style={styles.meta}>
              {row.portion.replace("_", " ")}
              {row.reason ? ` · ${row.reason}` : ""}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  help: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.full },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  empty: { color: colors.onSurfaceVariant },
  row: { gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontWeight: "700", color: colors.onSurface, flex: 1 },
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
