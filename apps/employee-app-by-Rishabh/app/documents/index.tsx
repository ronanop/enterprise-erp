import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssDocument } from "@/types/api";
import { colors } from "@/theme/colors";

export default function DocumentsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .documents()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load documents",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Documents" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Button title="Upload document" onPress={() => router.push("/documents/upload")} />
      {rows.length === 0 ? (
        <EmptyState title="No documents" message="Upload your first file." />
      ) : (
        rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push(`/documents/${row.id}`)}>
            <Card style={styles.card}>
              <Text style={styles.title}>{row.document_name}</Text>
              <Text style={styles.meta}>
                {row.document_type} · {row.verification_status}
              </Text>
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
  title: { fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceVariant, textTransform: "capitalize" },
});
