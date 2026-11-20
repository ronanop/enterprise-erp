import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssDocument } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "document";
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<EssDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  async function onDownload() {
    if (!id || !row) return;
    setDownloading(true);
    setError(null);
    try {
      const bytes = await essService.downloadDocumentBytes(id);
      if (Platform.OS === "web") {
        setError("Download share is available on iOS/Android builds.");
        return;
      }
      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        setError("File system unavailable on this platform.");
        return;
      }
      const path = `${dir}${safeFileName(row.document_name)}.bin`;
      await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/octet-stream",
          dialogTitle: "Share document",
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Download failed",
      );
    } finally {
      setDownloading(false);
    }
  }

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
          <Button
            title="Download / share"
            loading={downloading}
            onPress={() => void onDownload()}
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
