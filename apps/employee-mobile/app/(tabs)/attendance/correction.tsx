import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance } from "@/types/api";
import { colors, radii } from "@/theme/colors";
import {
  formatDisplayDateDDMMYYYY,
  formatTime,
  todayLocalDate,
} from "@/utils/datetime";

type CorrectionField = "check_in" | "check_out";

export default function CorrectionScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    params.date?.slice(0, 10) || todayLocalDate(),
  );
  const [fieldName, setFieldName] = useState<CorrectionField>("check_out");
  const [time, setTime] = useState("18:30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      essService
        .attendance()
        .then((att) => setRows(att.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load attendance",
          ),
        );
    }, []),
  );

  const target = useMemo(
    () => rows.find((r) => r.attendance_date === selectedDate) ?? null,
    [rows, selectedDate],
  );

  const recentDates = useMemo(
    () => rows.slice(0, 10).map((r) => r.attendance_date),
    [rows],
  );

  async function onSubmit() {
    if (!selectedDate) {
      setError("Pick a date first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // Match PWA: submit local wall-clock time, not UTC-shifted ISO.
      const newValue = `${selectedDate}T${time}:00`;
      const oldValue =
        fieldName === "check_in" ? target?.check_in_at : target?.check_out_at;
      await essService.createAttendanceCorrection({
        attendance_date: selectedDate,
        field_name: fieldName,
        new_value: newValue,
        reason: reason || undefined,
        attendance_id: target?.id,
        old_value: oldValue ?? undefined,
      });
      setMessage("Correction submitted for approval");
      setReason("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Correction" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <Card style={styles.form}>
        <Text style={styles.help}>
          Select a date and correct check-in or check-out time.
        </Text>
        <Text style={styles.label}>Recent dates</Text>
        <View style={styles.chips}>
          {recentDates.map((d) => (
            <Pressable
              key={d}
              onPress={() => setSelectedDate(d)}
              style={[styles.chip, selectedDate === d && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedDate === d && styles.chipTextActive,
                ]}
              >
                {formatDisplayDateDDMMYYYY(d)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextField
          label="Date (YYYY-MM-DD)"
          value={selectedDate}
          onChangeText={setSelectedDate}
          autoCapitalize="none"
        />
        {target ? (
          <Text style={styles.hint}>
            Current: in {formatTime(target.check_in_at)} · out{" "}
            {formatTime(target.check_out_at)}
          </Text>
        ) : (
          <Text style={styles.hint}>No punch record for this day.</Text>
        )}
        <View style={styles.chips}>
          {(["check_in", "check_out"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFieldName(f)}
              style={[styles.chip, fieldName === f && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  fieldName === f && styles.chipTextActive,
                ]}
              >
                {f === "check_in" ? "Check in" : "Check out"}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextField
          label="Time (HH:MM)"
          value={time}
          onChangeText={setTime}
          autoCapitalize="none"
          placeholder="18:30"
        />
        <TextField label="Reason" value={reason} onChangeText={setReason} />
        <Button
          title="Submit correction"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  help: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },
  chipTextActive: { color: "#fff" },
  hint: { fontSize: 12, color: colors.onSurfaceVariant },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
