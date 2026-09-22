import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, todayLocalDate } from "@/utils/datetime";
import { leaveStatusColor, leaveStatusDisplay } from "@/utils/leave-status";

type CompoffRow = {
  id: string;
  earned_date: string;
  extra_hours: number;
  requested_days: number;
  reason: string | null;
  status: string;
};

export default function CompOffScreen() {
  const [rows, setRows] = useState<CompoffRow[]>([]);
  const [earnedDate, setEarnedDate] = useState(todayLocalDate());
  const [extraHours, setExtraHours] = useState("8");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = await essService.listCompoff();
    setRows((list.data as CompoffRow[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load Comp Off",
        ),
      );
    }, [refresh]),
  );

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createCompoff({
        earned_date: earnedDate,
        extra_hours: Number(extraHours) || 0,
        reason: reason || undefined,
      });
      setMessage("Comp Off request submitted for manager → HR approval");
      setReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Comp Off" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <Card style={styles.form}>
        <TextField
          label="Earned date (YYYY-MM-DD)"
          value={earnedDate}
          onChangeText={setEarnedDate}
          autoCapitalize="none"
        />
        <TextField
          label="Extra hours"
          value={extraHours}
          onChangeText={setExtraHours}
          keyboardType="decimal-pad"
        />
        <TextField label="Reason" value={reason} onChangeText={setReason} />
        <Button
          title="Submit Comp Off"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </Card>

      <Text style={styles.section}>My requests</Text>
      {rows.map((row) => (
        <Card key={row.id} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle}>
              {formatDisplayDateDDMMYYYY(row.earned_date)} · {row.extra_hours}h
            </Text>
            <Text style={{ color: leaveStatusColor(row.status), fontWeight: "700" }}>
              {leaveStatusDisplay(row.status)}
            </Text>
          </View>
          {row.reason ? (
            <Text style={styles.meta}>{row.reason}</Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  row: { gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
