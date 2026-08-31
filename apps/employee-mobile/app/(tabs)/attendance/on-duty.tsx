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

type OnDutyRow = {
  id: string;
  duty_date: string;
  end_date: string | null;
  portion: string;
  duty_location: string | null;
  purpose: string | null;
  reason: string | null;
  status: string;
};

export default function OnDutyScreen() {
  const [rows, setRows] = useState<OnDutyRow[]>([]);
  const [dutyDate, setDutyDate] = useState(todayLocalDate());
  const [endDate, setEndDate] = useState("");
  const [portion, setPortion] = useState("full_day");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = await essService.listOnDuty();
    setRows((list.data as OnDutyRow[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load On Duty",
        ),
      );
    }, [refresh]),
  );

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createOnDuty({
        duty_date: dutyDate,
        end_date: endDate || undefined,
        portion,
        duty_location: location || undefined,
        purpose: purpose || undefined,
        reason: reason || undefined,
      });
      setMessage("On Duty request submitted for approval");
      setPurpose("");
      setReason("");
      setLocation("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="On Duty" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <Card style={styles.form}>
        <TextField
          label="Duty date (YYYY-MM-DD)"
          value={dutyDate}
          onChangeText={setDutyDate}
          autoCapitalize="none"
        />
        <TextField
          label="End date optional"
          value={endDate}
          onChangeText={setEndDate}
          autoCapitalize="none"
        />
        <TextField
          label="Portion (full_day / first_half / second_half)"
          value={portion}
          onChangeText={setPortion}
          autoCapitalize="none"
        />
        <TextField
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Client site / city"
        />
        <TextField
          label="Purpose"
          value={purpose}
          onChangeText={setPurpose}
        />
        <TextField label="Reason" value={reason} onChangeText={setReason} />
        <Button
          title="Submit On Duty"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </Card>

      <Text style={styles.section}>My requests</Text>
      {rows.map((row) => (
        <Card key={row.id} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle}>
              {formatDisplayDateDDMMYYYY(row.duty_date)}
            </Text>
            <Text style={{ color: leaveStatusColor(row.status), fontWeight: "700" }}>
              {leaveStatusDisplay(row.status)}
            </Text>
          </View>
          <Text style={styles.meta}>
            {[row.duty_location, row.purpose, row.portion]
              .filter(Boolean)
              .join(" · ")}
          </Text>
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
