import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAnnouncement } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

export default function AnnouncementsScreen() {
  const [rows, setRows] = useState<EssAnnouncement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .announcements()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load announcements",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Announcements" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {rows.length === 0 ? (
        <EmptyState title="No announcements" message="Check back later." />
      ) : (
        rows.map((row) => (
          <Card key={row.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.tag}>{row.tag}</Text>
              {row.pinned ? <Text style={styles.pin}>Pinned</Text> : null}
            </View>
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.body}>{row.body}</Text>
            <Text style={styles.meta}>
              {formatDisplayDateDDMMYYYY(row.published_on)}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  tag: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.primary,
  },
  pin: { fontSize: 10, fontWeight: "700", color: "#b45309" },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  body: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20 },
  meta: { fontSize: 11, color: colors.outline },
});
