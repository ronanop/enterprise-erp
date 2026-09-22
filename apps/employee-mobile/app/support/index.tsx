import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssSupportTicket } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/datetime";
import { leaveStatusColor, leaveStatusDisplay } from "@/utils/leave-status";

export default function SupportScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssSupportTicket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .supportTickets()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load tickets",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Support" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Button title="New ticket" onPress={() => router.push("/support/new")} />
      {rows.length === 0 ? (
        <EmptyState title="No tickets" message="Create a support request." />
      ) : (
        rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push(`/support/${row.id}`)}>
            <Card style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.title}>{row.subject}</Text>
                <Text style={{ color: leaveStatusColor(row.status), fontWeight: "700", fontSize: 12 }}>
                  {leaveStatusDisplay(row.status)}
                </Text>
              </View>
              <Text style={styles.meta}>
                {row.document_number} · {row.kind}
                {row.urgency ? ` · ${row.urgency}` : ""}
              </Text>
              <Text style={styles.meta}>{formatDateTime(row.created_at)}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 4 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
});
