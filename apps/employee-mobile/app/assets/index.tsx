import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAsset } from "@/types/api";
import { colors } from "@/theme/colors";

export default function AssetsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .assets()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load assets",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="My assets" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Button title="Scan barcode / QR" onPress={() => router.push("/assets/scan")} />
      {rows.length === 0 ? (
        <EmptyState title="No assets" message="Nothing assigned to you." />
      ) : (
        rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push(`/assets/${row.id}`)}>
            <Card style={styles.card}>
              <Text style={styles.title}>{row.asset_name}</Text>
              <Text style={styles.meta}>
                {row.asset_code} · {row.asset_type}
              </Text>
              <Text style={styles.meta}>
                {row.assignment_status ?? row.status}
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
