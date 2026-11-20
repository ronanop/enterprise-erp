import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { isPendingStatus } from "@/lib/attendance-request-ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAttendance, EssAttendanceCorrection } from "@/types/api";
import { colors, radii } from "@/theme/colors";
import {
  formatDisplayDateDDMMYYYY,
  formatTime,
  todayLocalDate,
} from "@/utils/datetime";

type CorrectionField = "check_in" | "check_out";

function fieldLabel(field: string) {
  if (field === "check_out") return "Check-out";
  if (field === "check_in") return "Check-in";
  return field.replace(/_/g, " ");
}

function statusTone(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s === "submitted") return { bg: "#EEF2FF", fg: "#3730A3" };
  if (s === "approved") return { bg: "#d1fae5", fg: "#065f46" };
  if (s === "rejected" || s === "cancelled")
    return { bg: "#ffdad6", fg: "#ba1a1a" };
  return { bg: "#F1F5F9", fg: "#475569" };
}

export default function CorrectionScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [rows, setRows] = useState<EssAttendance[]>([]);
  const [corrections, setCorrections] = useState<EssAttendanceCorrection[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    params.date?.slice(0, 10) || todayLocalDate(),
  );
  const [fieldName, setFieldName] = useState<CorrectionField>("check_out");
  const [time, setTime] = useState("18:30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refreshCorrections = useCallback(async () => {
    const res = await essService.listAttendanceCorrections();
    const list = [...(res.data ?? [])].sort((a, b) =>
      String(b.attendance_date).localeCompare(String(a.attendance_date)),
    );
    setCorrections(list);
    return list;
  }, []);

  const refreshAll = useCallback(async () => {
    const [att] = await Promise.all([
      essService.attendance(),
      refreshCorrections(),
    ]);
    setRows(att.data ?? []);
  }, [refreshCorrections]);

  useFocusEffect(
    useCallback(() => {
      refreshAll().catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load attendance",
        ),
      );
    }, [refreshAll]),
  );

  const target = useMemo(
    () => rows.find((r) => r.attendance_date === selectedDate) ?? null,
    [rows, selectedDate],
  );

  const recentDates = useMemo(
    () => rows.slice(0, 10).map((r) => r.attendance_date),
    [rows],
  );

  const openRequests = useMemo(
    () => corrections.filter((c) => isPendingStatus(c.status)),
    [corrections],
  );

  const openForSelectedDate = useMemo(
    () =>
      corrections.find(
        (c) =>
          String(c.attendance_date).slice(0, 10) === selectedDate &&
          isPendingStatus(c.status),
      ) ?? null,
    [corrections, selectedDate],
  );

  async function onSubmit() {
    if (!selectedDate) {
      setError("Pick a date first.");
      return;
    }
    if (openForSelectedDate) {
      setError("Revoke the pending request for this date before submitting another.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
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
      await refreshCorrections();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    setMessage(null);
    try {
      await essService.cancelAttendanceCorrection(id);
      setMessage("Request revoked.");
      await refreshCorrections();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Regularization" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      {openRequests.length > 0 ? (
        <>
          <Text style={styles.section}>Your submitted requests</Text>
          {openRequests.map((item) => {
            const tone = statusTone(item.status);
            const canRevoke = item.status.toLowerCase() === "submitted";
            return (
              <Card key={item.id} style={styles.requestCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>
                    {formatDisplayDateDDMMYYYY(item.attendance_date)} ·{" "}
                    {fieldLabel(item.field_name)}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  Corrected time:{" "}
                  <Text style={styles.metaStrong}>
                    {formatTime(item.new_value)}
                  </Text>
                </Text>
                {item.reason ? (
                  <Text style={styles.meta}>Reason: {item.reason}</Text>
                ) : null}
                {canRevoke ? (
                  <Button
                    title={
                      revokingId === item.id ? "Revoking…" : "Revoke request"
                    }
                    variant="secondary"
                    loading={revokingId === item.id}
                    onPress={() => void onRevoke(item.id)}
                    style={styles.revokeBtn}
                  />
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      {corrections.length > 0 && openRequests.length < corrections.length ? (
        <>
          <Text style={styles.section}>All corrections</Text>
          {corrections
            .filter((c) => !isPendingStatus(c.status))
            .map((item) => {
              const tone = statusTone(item.status);
              return (
                <Card key={item.id} style={styles.requestCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle}>
                      {formatDisplayDateDDMMYYYY(item.attendance_date)} ·{" "}
                      {fieldLabel(item.field_name)}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {formatTime(item.new_value)}
                  </Text>
                </Card>
              );
            })}
        </>
      ) : null}

      <Card style={styles.form}>
        <Text style={styles.help}>
          Select a date and correct check-in or check-out time.
        </Text>
        {openForSelectedDate ? (
          <Text style={styles.warn}>
            You already have a pending request for this date. Revoke it above to
            submit a new one.
          </Text>
        ) : null}
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
          disabled={Boolean(openForSelectedDate)}
          onPress={() => void onSubmit()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12, paddingBottom: 32 },
  form: { gap: 12 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  requestCard: { gap: 8 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontWeight: "700", color: colors.onSurface, flex: 1, fontSize: 14 },
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  metaStrong: { fontWeight: "600", color: colors.onSurface },
  revokeBtn: { marginTop: 4 },
  help: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  warn: {
    fontSize: 13,
    color: "#C2410C",
    lineHeight: 18,
    fontWeight: "500",
  },
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