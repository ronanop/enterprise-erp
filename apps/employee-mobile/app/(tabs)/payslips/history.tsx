import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconEye, IconEyeOff, IconWallet } from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBox,
  FilterChips,
  Screen,
  SearchField,
} from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { formatMoney } from "@/utils/datetime";

export default function PayslipHistoryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [query, setQuery] = useState("");
  const year = String(new Date().getFullYear());
  const [filter, setFilter] = useState(year);

  useFocusEffect(
    useCallback(() => {
      essService
        .payslips()
        .then((res) => {
          setRows(res.data ?? []);
          setError(null);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load history",
          ),
        );
    }, []),
  );

  const years = useMemo(() => {
    const values = new Set(
      rows.map((row) =>
        row.issued_at ? String(new Date(row.issued_at).getFullYear()) : year,
      ),
    );
    values.add(year);
    values.add(String(Number(year) - 1));
    values.add(String(Number(year) - 2));
    return [...values].sort((a, b) => Number(b) - Number(a));
  }, [rows, year]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const issuedYear = row.issued_at
        ? String(new Date(row.issued_at).getFullYear())
        : year;
      return (
        issuedYear === filter &&
        (!normalizedQuery ||
          row.document_number.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [filter, query, rows, year]);

  const annual = filtered.reduce(
    (sum, row) => sum + (Number(row.net_salary) || 0),
    0,
  );
  const average = filtered.length ? Math.round(annual / filtered.length) : 0;

  return (
    <Screen scroll header={<SubHeader title="Salary History" />} contentStyle={styles.content}>
      <View style={styles.privacyRow}>
        <Pressable
          accessibilityLabel="Toggle privacy"
          hitSlop={8}
          onPress={() => setHidden((value) => !value)}
          style={styles.eyeButton}
        >
          {hidden ? (
            <IconEyeOff size={20} color={colors.primary} />
          ) : (
            <IconEye size={20} color={colors.primary} />
          )}
        </Pressable>
      </View>
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <Card style={styles.summary}>
        <Text style={styles.kicker}>Annual Earnings {filter}</Text>
        <Text style={styles.annual}>
          {hidden ? "••••••••" : formatMoney(annual)}
        </Text>
        <Text style={styles.growth}>8.4% vs last year</Text>
      </Card>
      <Card style={styles.summary}>
        <Text style={styles.kicker}>Net Monthly Avg</Text>
        <Text style={styles.average}>
          {hidden ? "••••••" : formatMoney(average)}
        </Text>
        <View style={styles.payout}>
          <Text style={styles.payoutLabel}>Next Payout</Text>
          <Text style={styles.payoutValue}>28th</Text>
        </View>
      </Card>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search statements..."
      />
      <FilterChips options={years} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState
          title="No statements"
          icon={<IconWallet size={20} color={colors.primary} />}
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/(tabs)/payslips/${row.id}`)}
            >
              <Card style={styles.row}>
                <View style={styles.icon}>
                  <IconWallet size={18} color={colors.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{row.document_number}</Text>
                  <Text style={styles.meta}>
                    {row.payment_status} · Regular Salary
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amount}>
                    {hidden ? "••••" : formatMoney(row.net_salary)}
                  </Text>
                  <Text style={styles.deposited}>Deposited</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  privacyRow: { alignItems: "flex-end" },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { gap: 4, padding: 16 },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  annual: { fontSize: 30, fontWeight: "700", color: colors.onSurface },
  average: { fontSize: 24, fontWeight: "700", color: colors.onSurface },
  growth: { fontSize: 14, fontWeight: "600", color: colors.success },
  payout: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.3)",
    paddingTop: 12,
  },
  payoutLabel: { fontSize: 14, fontWeight: "600", color: colors.primary },
  payoutValue: { fontSize: 14, fontWeight: "600", color: colors.primary },
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
  },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  meta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  deposited: {
    overflow: "hidden",
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#ffffff",
  },
});
