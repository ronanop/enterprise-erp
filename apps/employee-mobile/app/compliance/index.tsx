import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPolicyItem } from "@/types/api";
import { colors } from "@/theme/colors";

export default function ComplianceScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssPolicyItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .policies()
        .then((res) => setRows(res.data ?? []))
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load policies",
          ),
        );
    }, []),
  );

  return (
    <Screen scroll header={<SubHeader title="Compliance" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {rows.length === 0 ? (
        <EmptyState title="No policies" message="Nothing to acknowledge." />
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/compliance/${row.id}`)}
          >
            <Card style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.title}>{row.title}</Text>
                <Text
                  style={{
                    color: row.acknowledged ? "#007d55" : "#b45309",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {row.acknowledged ? "Done" : "Pending"}
                </Text>
              </View>
              <Text style={styles.meta}>
                {row.policy_code} · v{row.policy_version}
                {row.is_mandatory ? " · Mandatory" : ""}
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
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
});
