import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssAssetDetail } from "@/types/api";
import { colors } from "@/theme/colors";

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<EssAssetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    essService
      .asset(id)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load asset",
        ),
      );
  }, [id]);

  return (
    <Screen scroll header={<SubHeader title="Asset" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>{row.asset_name}</Text>
            <Text style={styles.meta}>{row.asset_code}</Text>
          </Card>
          <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
            <ListRow title="Type" subtitle={row.asset_type} />
            <ListRow title="Serial" subtitle={row.serial_number ?? "—"} />
            <ListRow title="Status" subtitle={row.status} />
            <ListRow
              title="Assignment"
              subtitle={row.assignment_status ?? "—"}
            />
          </Card>
          <Button
            title="Report issue"
            onPress={() =>
              router.push({
                pathname: "/assets/report",
                params: { assetId: row.id, assetName: row.asset_name },
              })
            }
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.onSurfaceVariant },
});
