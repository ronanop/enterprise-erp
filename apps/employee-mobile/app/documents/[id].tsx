import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssDocument } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<EssDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    essService
      .document(id)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load document",
        ),
      );
  }, [id]);

  return (
    <Screen scroll header={<SubHeader title="Document" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>{row.document_name}</Text>
            <Text style={styles.meta}>{row.document_number}</Text>
          </Card>
          <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
            <ListRow title="Type" subtitle={row.document_type} />
            <ListRow title="Status" subtitle={row.status} />
            <ListRow title="Verification" subtitle={row.verification_status} />
            <ListRow
              title="Issued"
              subtitle={formatDisplayDateDDMMYYYY(row.issued_on)}
            />
          </Card>
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
