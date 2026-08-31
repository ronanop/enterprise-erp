import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconWallet,
} from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBox,
  GradientCard,
  Screen,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { formatMoney } from "@/utils/datetime";

export default function PayslipsScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

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
            err instanceof ApiClientError
              ? err.message
              : "Failed to load payslips",
          ),
        );
    }, []),
  );

  const latest = rows[0];
  const trend = useMemo(() => {
    const recent = [...rows].slice(0, 6).reverse();
    const max = Math.max(...recent.map((r) => Number(r.net_salary) || 0), 1);
    return recent.map((r) => ({
      id: r.id,
      label: monthLabel(r.document_number, r.issued_at),
      pct: ((Number(r.net_salary) || 0) / max) * 100,
      current: r.id === latest?.id,
    }));
  }, [rows, latest?.id]);
  const ytd = rows.reduce((sum, r) => sum + (Number(r.net_salary) || 0), 0);
  const deducted = rows.reduce(
    (sum, r) => sum + (Number(r.total_deductions) || 0),
    0,
  );

  return (
    <Screen
      scroll
      tabClearance
      header={<AppHeader title="Salary" name={me?.display_name} />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {latest ? (
        <GradientCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroKicker}>
                {monthLabel(latest.document_number, latest.issued_at)}
              </Text>
              <Text style={styles.heroTitle}>Net Pay</Text>
            </View>
            <Pressable
              accessibilityLabel={hidden ? "Show amounts" : "Hide amounts"}
              onPress={() => setHidden((v) => !v)}
              style={styles.eyeButton}
            >
              {hidden ? (
                <IconEyeOff size={18} color="#ffffff" />
              ) : (
                <IconEye size={18} color="#ffffff" />
              )}
            </Pressable>
          </View>
          <Text style={styles.net}>
            {hidden ? "••••••" : formatMoney(latest.net_salary)}
          </Text>
          <View style={styles.heroStats}>
            <Mini
              label="Gross"
              value={hidden ? "••••" : `₹${shortMoney(latest.gross_salary)}`}
            />
            <Mini
              label="Tax / Ded"
              value={
                hidden ? "••••" : `₹${shortMoney(latest.total_deductions)}`
              }
            />
            <Mini
              label="Status"
              value={latest.payment_status?.slice(0, 8) ?? "—"}
            />
          </View>
        </GradientCard>
      ) : null}

      {trend.length ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeading}>{Math.min(6, trend.length)}-Month Trend</Text>
            <Text style={styles.hint}>Latest slips</Text>
          </View>
          <Card style={styles.trendCard}>
            {trend.map((bar) => (
              <View key={bar.id} style={styles.barColumn}>
                <View style={styles.barSpace}>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: `${Math.max(8, bar.pct)}%`,
                        backgroundColor: bar.current
                          ? colors.primaryContainer
                          : colors.primaryFixed,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.statGrid}>
        <StatCard
          label="YTD Earnings"
          value={hidden ? "••••" : formatMoney(ytd)}
          color={colors.primaryContainer}
          track={colors.surfaceHighest}
          fill="75%"
        />
        <StatCard
          label="Total Deducted"
          value={hidden ? "••••" : formatMoney(deducted)}
          color={colors.secondary}
          track="#eaddff"
          fill="50%"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>Recent Payslips</Text>
          <Pressable onPress={() => router.push("/(tabs)/payslips/history")}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.quickRows}>
          {[
            ["Breakdown", "/(tabs)/payslips/breakdown"],
            ["History", "/(tabs)/payslips/history"],
            ["Tax", "/(tabs)/payslips/tax"],
          ].map(([label, href]) => (
            <Pressable
              key={label}
              onPress={() =>
                router.push(
                  href as
                    | "/(tabs)/payslips/breakdown"
                    | "/(tabs)/payslips/history"
                    | "/(tabs)/payslips/tax",
                )
              }
              style={styles.quickPill}
            >
              <Text style={styles.quickText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {rows.length === 0 && !error ? (
          <EmptyState
            title="No payslips yet"
            description="When payroll issues a slip, it will appear here."
            icon={<IconWallet size={20} color={colors.primary} />}
          />
        ) : (
          <View style={styles.list}>
            {rows.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/(tabs)/payslips/${row.id}`)}
              >
                <Card style={styles.payslipRow}>
                  <View style={styles.walletIcon}>
                    <IconWallet size={20} color={colors.primary} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{row.document_number}</Text>
                    <Text style={styles.rowMeta}>
                      {row.payment_status} · {row.status}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowAmt}>
                      {hidden ? "••••" : formatMoney(row.net_salary)}
                    </Text>
                    <View style={styles.download}>
                      <IconDownload size={16} color={colors.primary} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>
        {value}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  track,
  fill,
}: {
  label: string;
  value: string;
  color: string;
  track: string;
  fill: `${number}%`;
}) {
  return (
    <Card style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={[styles.miniTrack, { backgroundColor: track }]}>
        <View style={[styles.miniFill, { width: fill, backgroundColor: color }]} />
      </View>
    </Card>
  );
}

function shortMoney(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function monthLabel(doc: string, issuedAt?: string | null) {
  if (issuedAt) {
    return new Date(issuedAt).toLocaleString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }
  const match = doc.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  return match?.[1]?.slice(0, 3) ?? doc.slice(0, 6);
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 32, gap: 24 },
  hero: { gap: 8 },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  heroKicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2 },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  net: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroStats: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  miniLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  miniValue: { color: "#fff", fontWeight: "700", marginTop: 2, fontSize: 14 },
  section: { gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 2 },
  sectionHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  hint: { fontSize: 12, fontWeight: "500", color: colors.primary },
  seeAll: { fontSize: 14, fontWeight: "500", color: colors.primary },
  trendCard: { height: 192, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, padding: 20 },
  barColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  barSpace: { flex: 1, width: "100%", justifyContent: "flex-end" },
  trendBar: { alignSelf: "center", width: "100%", maxWidth: 36, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", color: colors.onSurfaceVariant },
  statGrid: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderLeftWidth: 4, gap: 4 },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, color: colors.onSurfaceVariant },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  miniTrack: { height: 6, overflow: "hidden", borderRadius: 3, marginTop: 8 },
  miniFill: { height: "100%", borderRadius: 3 },
  quickRows: { flexDirection: "row", gap: 8 },
  quickPill: { flex: 1, borderRadius: 12, backgroundColor: colors.surfaceLow, paddingHorizontal: 8, paddingVertical: 12, alignItems: "center" },
  quickText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  list: { gap: 8 },
  payslipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, backgroundColor: colors.primaryFixed },
  rowCopy: { flex: 1 },
  rowTitle: { fontWeight: "700", color: colors.onSurface },
  rowMeta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowAmt: { fontWeight: "700", color: colors.onSurface },
  download: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, borderWidth: 1, borderColor: "rgba(37,99,235,0.3)" },
});
