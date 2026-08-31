import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Button, Card, ErrorBox, ListRow, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, formatMoney } from "@/utils/datetime";

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
      {row ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>
              {row.period_name ?? row.document_number}
            </Text>
            <Text style={styles.meta}>
              Issued {formatDisplayDateDDMMYYYY(row.issued_at)}
            </Text>
            <Text style={styles.net}>{formatMoney(row.net_salary)}</Text>
            <Text style={styles.meta}>Net pay</Text>
          </Card>

          <Card style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
            <ListRow title="Gross" subtitle={formatMoney(row.gross_salary)} />
            <ListRow
              title="Deductions"
              subtitle={formatMoney(row.total_deductions)}
            />
            <ListRow title="Payment" subtitle={row.payment_status} />
            <ListRow title="Document" subtitle={row.document_number} />
          </Card>

          {(row.earnings?.length || row.deductions?.length) ? (
            <Card style={{ gap: 8 }}>
              <Text style={styles.section}>Breakdown</Text>
              {row.earnings?.map((e, i) => (
                <View key={`e-${i}`} style={styles.line}>
                  <Text style={styles.lineLabel}>{e.label ?? e.code}</Text>
                  <Text style={styles.lineVal}>{formatMoney(e.amount)}</Text>
                </View>
              ))}
              {row.deductions?.map((d, i) => (
                <View key={`d-${i}`} style={styles.line}>
                  <Text style={styles.lineLabel}>{d.label ?? d.code}</Text>
                  <Text style={[styles.lineVal, { color: colors.error }]}>
                    -{formatMoney(d.amount)}
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
