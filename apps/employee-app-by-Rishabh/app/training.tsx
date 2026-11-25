import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssTrainingItem } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

export default function TrainingScreen() {
  const [rows, setRows] = useState<EssTrainingItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .training()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load training",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Training" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {rows.length === 0 ? (
        <EmptyState
          title="No training assigned"
          message="Upcoming courses will show up here."
        />
      ) : (
        rows.map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.title}>{r.training_name}</Text>
              <Text style={styles.badge}>{r.attendance_status}</Text>
            </View>
            <Text style={styles.meta}>
              {r.training_code}
              {r.start_date
                ? ` · ${formatDisplayDateDDMMYYYY(r.start_date)}`
                : ""}
              {r.training_type ? ` · ${r.training_type}` : ""}
            </Text>
            <Text style={styles.meta}>Status: {r.status}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.primary,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
});
