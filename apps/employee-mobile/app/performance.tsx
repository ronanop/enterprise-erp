import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPerformanceItem } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

export default function PerformanceScreen() {
  const [rows, setRows] = useState<EssPerformanceItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .performance()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load performance",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Performance" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {rows.length === 0 ? (
        <EmptyState
          title="No performance reviews yet"
          message="Reviews will appear here when published."
        />
      ) : (
        rows.map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.title}>{r.document_number}</Text>
              <Text style={styles.badge}>{r.status}</Text>
            </View>
            <Text style={styles.meta}>
              {r.review_cycle}
              {r.period_start && r.period_end
                ? ` · ${formatDisplayDateDDMMYYYY(r.period_start)} → ${formatDisplayDateDDMMYYYY(r.period_end)}`
                : ""}
            </Text>
            {r.overall_rating != null ? (
              <Text style={styles.rating}>Rating {r.overall_rating}/5</Text>
            ) : (
              <Text style={styles.meta}>Rating pending</Text>
            )}
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
  rating: { fontSize: 14, fontWeight: "700", color: colors.primary },
});
