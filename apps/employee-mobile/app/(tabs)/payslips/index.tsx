import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFocusEffect, useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import {
  IconCalendar,
  IconChevronRight,
  IconDocument,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconWallet,
} from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBox,
  Screen,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import {
  formatInr,
  parsePayslipLines,
  periodLabel,
} from "@/lib/payslip-display";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_CARD, RADIUS_FULL } from "@/theme/tokens";

function formatInrParts(value: number | string, hidden: boolean) {
  if (hidden) return { main: "₹ XX,XXX", frac: "" };
  const n = Number(value) || 0;
  const [whole, frac = "00"] = n
    .toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  return { main: `₹ ${whole}`, frac: `.${frac}` };
}

function fiscalYearLabel(slip: EssPayslip | undefined) {
  const raw = slip?.period_start || slip?.issued_at;
  const d = raw ? new Date(raw) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 3 ? y : y - 1;
  const end = String(start + 1).slice(-2);
  return `FY ${start}-${end}`;
}

function disbursedLabel(slip: EssPayslip) {
  if (!slip.issued_at) return slip.payment_status || "Pending";
  const d = new Date(slip.issued_at);
  return `Disbursed ${d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  })}`;
}

function monthShort(slip: EssPayslip) {
  const raw = slip.period_start || slip.issued_at;
  if (!raw) return "—";
  return new Date(raw)
    .toLocaleDateString("en-IN", { month: "short" })
    .toUpperCase();
}

function shortInrLakhs(value: number) {
  if (value >= 100000)
    return `${(value / 100000).toFixed(2).replace(/\.?0+$/, "")}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function hasAdjustment(slip: EssPayslip) {
  const pj = (slip.payslip_json ?? {}) as Record<string, unknown>;
  if (pj.adjustment || pj.has_adjustment) return true;
  const earnings = slip.earnings ?? (pj.earnings as unknown);
  if (Array.isArray(earnings)) {
    return earnings.some((row) => {
      const label = String(
        (row as { label?: string; code?: string }).label ||
          (row as { code?: string }).code ||
          "",
      );
      return /adj|bonus|arrear/i.test(label);
    });
  }
  return false;
}

async function sharePayslipText(slip: EssPayslip) {
  const text = await essService.downloadPayslipText(slip.id);
  if (Platform.OS === "web") {
    await Share.share({ message: text, title: `Payslip ${slip.document_number}` });
    return;
  }
  const canShareFile = await Sharing.isAvailableAsync();
  const dir = FileSystem.cacheDirectory;
  if (canShareFile && dir) {
    const path = `${dir}payslip-${slip.document_number}.txt`;
    await FileSystem.writeAsStringAsync(path, text);
    await Sharing.shareAsync(path, {
      mimeType: "text/plain",
      dialogTitle: "Share payslip",
    });
    return;
  }
  await Share.share({
    message: text,
    title: `Payslip ${slip.document_number}`,
  });
}

export default function PayslipsScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [detail, setDetail] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const [pay, meRes] = await Promise.all([
            essService.payslips(),
            essService.me(),
          ]);
          if (cancelled) return;
          const list = pay.data ?? [];
          setRows(list);
          void meRes;
          setError(null);
          if (list[0]?.id) {
            try {
              const full = await essService.payslip(list[0].id);
              if (!cancelled) setDetail(full.data ?? list[0]);
            } catch {
              if (!cancelled) setDetail(list[0]);
            }
          } else {
            setDetail(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof ApiClientError
                ? err.message
                : "Failed to load payslips",
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const latest = detail ?? rows[0] ?? null;
  const recent = rows.slice(0, 3);
  const parsed = useMemo(
    () => (latest ? parsePayslipLines(latest) : null),
    [latest],
  );
  const fy = fiscalYearLabel(latest ?? undefined);
  const netParts = formatInrParts(parsed?.net ?? latest?.net_salary ?? 0, masked);
  const periodShort = latest
    ? new Date(
        latest.period_start || latest.issued_at || Date.now(),
      ).toLocaleDateString("en-IN", { month: "short" })
    : "";

  const trend = useMemo(() => {
    const slice = [...rows].slice(0, 6).reverse();
    const amounts = slice.map((r) => Number(r.net_salary) || 0);
    const max = Math.max(...amounts, 1);
    const avg =
      amounts.length > 0
        ? amounts.reduce((s, n) => s + n, 0) / amounts.length
        : 0;
    return {
      bars: slice.map((r, i) => ({
        id: r.id,
        label: monthShort(r),
        amount: amounts[i]!,
        height: Math.max(18, Math.round((amounts[i]! / max) * 84)),
        active: i === slice.length - 1,
      })),
      avg,
    };
  }, [rows]);

  async function onDownloadLatest() {
    if (!latest) return;
    setDownloading(true);
    setError(null);
    try {
      await sharePayslipText(latest);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Download failed",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function onDownloadRow(slip: EssPayslip) {
    setDownloadingId(slip.id);
    setError(null);
    try {
      await sharePayslipText(slip);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Download failed",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Screen
      scroll
      tabClearance
      header={<AppHeader title="Salary" name={me?.display_name} />}
      contentStyle={styles.content}
    >
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {loading ? (
        <Text style={styles.loadingText}>Loading salary…</Text>
      ) : !latest || !parsed ? (
        <EmptyState
          title="No payslips yet"
          description="When payroll issues a slip, it will appear here."
          icon={<IconDocument size={20} color={colors.primary} />}
        />
      ) : (
        <>
          <View style={styles.filterRow}>
            <View style={styles.filterChips}>
              <View style={styles.inrChip}>
                <Text style={styles.inrChipText}>INR (₹)</Text>
              </View>
              <View style={styles.fyChip}>
                <Text style={styles.fyChipText}>{fy}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/payslips/history")}
              style={({ pressed }) => [
                styles.statementLink,
                pressed ? styles.pressed : null,
              ]}
            >
              <IconDocument size={14} color="#004ac6" />
              <Text style={styles.statementText}>Statement</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroOrbRight} />
            <View style={styles.heroOrbLeft} />

            <View style={styles.heroInner}>
              <View style={styles.heroHeader}>
                <View style={styles.heroKickerRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.heroKicker}>
                    {periodLabel(latest)} Net Payout
                  </Text>
                </View>
                <View style={styles.disbursedPill}>
                  <Text style={styles.disbursedText}>
                    {disbursedLabel(latest)}
                  </Text>
                </View>
              </View>

              <View style={styles.netRowWrap}>
                <View style={styles.netRow}>
                  <Text style={styles.net}>{netParts.main}</Text>
                  {netParts.frac ? (
                    <Text style={styles.netFrac}>{netParts.frac}</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel={masked ? "Show amount" : "Hide amount"}
                  onPress={() => setMasked((v) => !v)}
                  style={({ pressed }) => [
                    styles.eyeButton,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  {masked ? (
                    <IconEyeOff size={22} color="#d3e3ff" />
                  ) : (
                    <IconEye size={22} color="#d3e3ff" />
                  )}
                </Pressable>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.statCol}>
                  <Text style={styles.miniLabel}>Gross Earnings</Text>
                  <Text style={styles.miniValue}>
                    {masked
                      ? "₹ XX,XXX"
                      : formatInr(parsed.gross).replace("₹", "₹ ")}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={[styles.statCol, styles.statColEnd]}>
                  <Text style={styles.miniLabel}>Total Deductions</Text>
                  <Text style={[styles.miniValue, styles.miniDanger]}>
                    {masked
                      ? "-₹ XX,XXX"
                      : `-${formatInr(parsed.deductionsTotal).replace("₹", "₹ ")}`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                disabled={downloading}
                onPress={() => void onDownloadLatest()}
                style={({ pressed }) => [
                  styles.downloadBtn,
                  pressed ? styles.pressed : null,
                  downloading ? styles.btnDisabled : null,
                ]}
              >
                <IconDownload size={16} color="#ffffff" />
                <Text style={styles.downloadBtnText} numberOfLines={1}>
                  {downloading
                    ? "Preparing…"
                    : `${periodShort || "Latest"} Payslip`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/payslips/breakdown")}
                style={({ pressed }) => [
                  styles.breakdownBtn,
                  pressed ? styles.pressed : null,
                ]}
              >
                <IconWallet size={16} color="#ffffff" />
                <Text style={styles.breakdownBtnText}>Breakdown</Text>
              </Pressable>
            </View>
          </View>

          {trend.bars.length > 0 ? (
            <Card style={styles.trendCard}>
              <View style={styles.trendHeading}>
                <Text style={styles.trendTitle}>
                  Salary Trend (Last {trend.bars.length} Mos)
                </Text>
                <Text style={styles.trendSub}>
                  Average{" "}
                  {formatInr(Math.round(trend.avg)).replace("₹", "₹")} / month
                </Text>
              </View>
              <View style={styles.trendBars}>
                {trend.bars.map((bar) => (
                  <Pressable
                    key={bar.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/(tabs)/payslips/${bar.id}`)}
                    style={styles.barColumn}
                  >
                    <Text
                      style={[
                        styles.barAmount,
                        bar.active ? styles.barAmountActive : styles.barAmountMuted,
                      ]}
                    >
                      {shortInrLakhs(bar.amount)}
                    </Text>
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: bar.height,
                          backgroundColor: bar.active ? "#004ac6" : "#e6eeff",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.barLabel,
                        bar.active ? styles.barLabelActive : null,
                      ]}
                    >
                      {bar.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}

          <Card style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent Payslips</Text>
              <Pressable onPress={() => router.push("/(tabs)/payslips/history")}>
                <Text style={styles.viewAll}>
                  View All ({rows.length})
                </Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {recent.map((row, idx) => {
                const adj = hasAdjustment(row);
                return (
                  <View key={row.id} style={styles.payslipRow}>
                    <Pressable
                      onPress={() => router.push(`/(tabs)/payslips/${row.id}`)}
                      style={styles.payslipMain}
                    >
                      <View
                        style={[
                          styles.rowIcon,
                          idx === 0 ? styles.rowIconActive : styles.rowIconMuted,
                        ]}
                      >
                        <IconCalendar
                          size={18}
                          color={idx === 0 ? "#004ac6" : "#434654"}
                        />
                      </View>
                      <View style={styles.rowCopy}>
                        <View style={styles.rowTitleRow}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {periodLabel(row)}
                          </Text>
                          {adj ? (
                            <View style={styles.adjBadge}>
                              <Text style={styles.adjText}>Adj.</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.rowMeta}>
                          {formatInr(row.net_salary, masked).replace("₹", "₹ ")}{" "}
                          • {disbursedLabel(row)}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityLabel="Download payslip"
                        disabled={downloadingId === row.id}
                        onPress={() => void onDownloadRow(row)}
                        style={({ pressed }) => [
                          styles.iconAction,
                          pressed ? styles.iconActionHover : null,
                        ]}
                      >
                        {downloadingId === row.id ? (
                          <ActivityIndicator size="small" color="#004ac6" />
                        ) : (
                          <IconDownload size={18} color="#434654" />
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Open ${periodLabel(row)}`}
                        onPress={() => router.push(`/(tabs)/payslips/${row.id}`)}
                        style={({ pressed }) => [
                          styles.iconAction,
                          pressed ? styles.iconActionHover : null,
                        ]}
                      >
                        <IconChevronRight size={18} color="#434654" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  loadingText: {
    paddingVertical: 48,
    textAlign: "center",
    fontSize: 14,
    color: "#737686",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 2,
  },
  filterChips: { flexDirection: "row", alignItems: "center", gap: 8 },
  inrChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  inrChipText: { fontSize: 12, fontWeight: "600", color: "#0b1c30" },
  fyChip: {
    borderRadius: RADIUS_FULL,
    backgroundColor: "#dde9ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fyChipText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#434654",
  },
  statementLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS_FULL,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statementText: { fontSize: 12, fontWeight: "600", color: "#004ac6" },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS_CARD,
    backgroundColor: "#213146",
    minHeight: 220,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroOrbRight: {
    position: "absolute",
    right: -64,
    top: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: "rgba(0,74,198,0.3)",
    opacity: 0.85,
  },
  heroOrbLeft: {
    position: "absolute",
    left: -48,
    bottom: -48,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(113,42,226,0.2)",
    opacity: 0.85,
  },
  heroInner: { position: "relative", zIndex: 1, gap: 16 },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroKickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#52e1a6",
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#d3e3ff",
  },
  disbursedPill: {
    borderRadius: RADIUS_FULL,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  disbursedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#d3e3ff",
  },
  netRowWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 4,
  },
  netRow: { flexDirection: "row", alignItems: "baseline", gap: 2, flex: 1 },
  net: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  netFrac: { fontSize: 12, color: "#d3e3ff" },
  eyeButton: {
    padding: 8,
    borderRadius: RADIUS_FULL,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
  },
  statCol: { flex: 1 },
  statColEnd: { alignItems: "flex-end" },
  heroDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#d3e3ff",
  },
  miniValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  miniDanger: { color: "#ffdad6" },
  heroActions: {
    position: "relative",
    zIndex: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#004ac6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#004ac6",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    flexShrink: 1,
  },
  breakdownBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdownBtnText: { fontSize: 12, fontWeight: "600", color: "#ffffff" },
  btnDisabled: { opacity: 0.6 },
  trendCard: { gap: 12 },
  trendHeading: { gap: 2 },
  trendTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: "#0b1c30",
  },
  trendSub: { fontSize: 12, color: "#434654" },
  trendBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 112,
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    height: "100%",
  },
  barAmount: { fontSize: 10, fontWeight: "700" },
  barAmountActive: { color: "#004ac6" },
  barAmountMuted: { color: "#434654", opacity: 0.55 },
  trendBar: {
    width: "100%",
    maxWidth: 36,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#434654",
  },
  barLabelActive: { color: "#004ac6" },
  recentSection: { gap: 12 },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: "#0b1c30",
  },
  viewAll: { fontSize: 12, fontWeight: "600", color: "#004ac6" },
  list: { gap: 8 },
  payslipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    backgroundColor: "#eff4ff",
    padding: 12,
  },
  payslipMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  rowIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  rowIconActive: { backgroundColor: "#dbe1ff" },
  rowIconMuted: { backgroundColor: "#e6eeff" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0b1c30",
  },
  adjBadge: {
    borderRadius: 4,
    backgroundColor: "#eaddff",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adjText: { fontSize: 10, fontWeight: "700", color: "#25005a" },
  rowMeta: { marginTop: 2, fontSize: 12, color: "#434654" },
  rowActions: { flexDirection: "row", alignItems: "center" },
  iconAction: {
    padding: 8,
    borderRadius: RADIUS_FULL,
  },
  iconActionHover: { backgroundColor: "#d3e3ff" },
});