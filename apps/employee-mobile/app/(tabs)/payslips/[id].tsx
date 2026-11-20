import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Button, Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import {
  formatInr,
  parsePayslipLines,
  periodLabel,
} from "@/lib/payslip-display";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

export default function PayslipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    essService
      .payslip(id)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load payslip",
        ),
      );
  }, [id]);

  const parsed = useMemo(
    () => (row ? parsePayslipLines(row) : null),
    [row],
  );

  async function onShare() {
    if (!id || !row) return;
    setSharing(true);
    setError(null);
    try {
      const text = await essService.downloadPayslipText(id);
      if (Platform.OS === "web") {
        setError("Share is available on iOS/Android builds.");
        return;
      }
      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        setError("File system unavailable on this platform.");
        return;
      }
      const path = `${dir}payslip-${row.document_number}.txt`;
      await FileSystem.writeAsStringAsync(path, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/plain",
          dialogTitle: "Share payslip",
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Share failed",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Payslip" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row && parsed ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>{periodLabel(row)}</Text>
            <Text style={styles.meta}>
              Issued {formatDisplayDateDDMMYYYY(row.issued_at)}
            </Text>
            <Text style={styles.net}>{formatInr(parsed.net)}</Text>
            <Text style={styles.meta}>Net pay</Text>
          </Card>

          <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
            <ListRow title="Gross" subtitle={formatInr(parsed.gross)} />
            <ListRow
              title="Deductions"
              subtitle={formatInr(parsed.deductionsTotal)}
            />
            <ListRow title="Payment" subtitle={row.payment_status} />
            <ListRow title="Document" subtitle={row.document_number} />
          </Card>

          {parsed.earnings.length || parsed.deductions.length ? (
            <Card style={{ gap: 8 }}>
              <Text style={styles.section}>Earnings</Text>
              {parsed.earnings.map((e) => (
                <View key={`e-${e.label}`} style={styles.line}>
                  <Text style={styles.lineLabel}>{e.label}</Text>
                  <Text style={styles.lineVal}>{formatInr(e.amount)}</Text>
                </View>
              ))}
              <Text style={[styles.section, { marginTop: 8 }]}>Deductions</Text>
              {parsed.deductions.map((d) => (
                <View key={`d-${d.label}`} style={styles.line}>
                  <Text style={styles.lineLabel}>{d.label}</Text>
                  <Text style={[styles.lineVal, { color: colors.error }]}>
                    -{formatInr(d.amount)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Button
            title="Download / share"
            loading={sharing}
            onPress={() => void onShare()}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.onSurfaceVariant },
  net: { fontSize: 32, fontWeight: "700", color: colors.primary, marginTop: 8 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  lineLabel: { color: colors.onSurface, fontSize: 14 },
  lineVal: { fontWeight: "600", color: colors.onSurface },
});