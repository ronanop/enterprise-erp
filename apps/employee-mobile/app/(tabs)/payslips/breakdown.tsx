import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconEye, IconEyeOff, IconWallet } from "@/components/icons";
import { Card, ErrorBox, GradientCard, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { formatMoney } from "@/utils/datetime";

export default function PayslipBreakdownScreen() {
  const router = useRouter();
  const [latest, setLatest] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const list = await essService.payslips();
          const summary = (list.data ?? [])[0];
          if (!summary) {
            setLatest(null);
            setError(null);
            return;
          }
          const detail = await essService.payslip(summary.id);
          setLatest(detail.data ?? summary);
          setError(null);
        } catch (err) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load salary",
          );
        }
      })();
    }, []),
  );

  const net = Number(latest?.net_salary) || 0;
  const gross = Number(latest?.gross_salary) || 0;
  const deductions = Number(latest?.total_deductions) || 0;
  const earnings = (latest?.earnings ?? [])
    .map((line) => ({
      title: line.label ?? line.code ?? "Earnings",
      value: Number(line.amount) || 0,
    }))
    .filter((line) => line.value > 0);
  const deductionLines = (latest?.deductions ?? [])
    .map((line) => ({
      title: line.label ?? line.code ?? "Deduction",
      value: Number(line.amount) || 0,
    }))
    .filter((line) => line.value > 0);
  const displayEarnings =
    earnings.length > 0
      ? earnings
      : [
          { title: "Basic Salary", value: Math.round(gross * 0.55) },
          { title: "HRA", value: Math.round(gross * 0.2) },
          {
            title: "Allowances",
            value: Math.max(0, gross - Math.round(gross * 0.55) - Math.round(gross * 0.2)),
          },
        ];
  const displayDeductions =
    deductionLines.length > 0
      ? deductionLines
      : deductions > 0
        ? [{ title: "Tax & PF", value: deductions }]
        : [];

  return (
    <Screen scroll header={<SubHeader title="Salary Breakdown" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Card style={styles.period}>
        <Text style={styles.periodText}>
          {latest?.period_name ?? "Current Period"}
        </Text>
      </Card>

      <GradientCard style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroKicker}>Net Monthly Salary</Text>
          <Pressable
            accessibilityLabel={hidden ? "Show amounts" : "Hide amounts"}
            onPress={() => setHidden((value) => !value)}
            style={styles.eye}
          >
            {hidden ? (
              <IconEyeOff size={16} color="#ffffff" />
            ) : (
              <IconEye size={16} color="#ffffff" />
            )}
          </Pressable>
        </View>
        <Text style={styles.net}>{hidden ? "••••••" : formatMoney(net)}</Text>
        <Text style={styles.increase}>+4.2% increase from last month</Text>
      </GradientCard>

      <Card style={styles.composition}>
        <Text style={styles.sectionTitle}>Salary Composition</Text>
        <View style={styles.donut}>
          <View style={styles.donutInner}>
            <Text style={styles.donutCaption}>Earnings</Text>
            <Text style={styles.donutValue}>
              {gross ? `${Math.round((net / gross) * 100)}%` : "—"}
            </Text>
          </View>
        </View>
        <View style={styles.legend}>
          <Legend color="#2563eb" label="Basic Pay" />
          <Legend color="#60a5fa" label="HRA" />
          <Legend color="#712ae2" label="Allowances" />
          <Legend color={colors.error} label="Deductions" />
        </View>
      </Card>

      <View style={styles.lines}>
        {displayEarnings.map((line, index) => (
          <PayLine
            key={`earning-${line.title}-${index}`}
            title={line.title}
            subtitle="Earnings"
            value={line.value}
            hidden={hidden}
            tone={index === displayEarnings.length - 1 ? "purple" : "blue"}
          />
        ))}
        {displayDeductions.map((line, index) => (
          <PayLine
            key={`deduction-${line.title}-${index}`}
            title={line.title}
            subtitle="Deduction"
            value={line.value}
            hidden={hidden}
            tone="red"
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push("/(tabs)/payslips/history")}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryText}>History</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/payslips/tax")}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryText}>Tax & Benefits</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function PayLine({
  title,
  subtitle,
  value,
  hidden,
  tone,
}: {
  title: string;
  subtitle: string;
  value: number;
  hidden: boolean;
  tone: "blue" | "purple" | "red";
}) {
  const color = tone === "red" ? colors.error : colors.onSurface;
  const iconColor = tone === "purple" ? colors.secondary : tone === "red" ? colors.error : colors.primary;
  const iconBackground =
    tone === "purple" ? "#eaddff" : tone === "red" ? "#ffdad6" : colors.primaryFixed;
  return (
    <Card style={styles.line}>
      <View style={[styles.lineIcon, { backgroundColor: iconBackground }]}>
        <IconWallet size={18} color={iconColor} />
      </View>
      <View style={styles.lineCopy}>
        <Text style={styles.lineTitle}>{title}</Text>
        <Text style={styles.lineSub}>{subtitle}</Text>
      </View>
      <Text style={[styles.lineValue, { color }]}>
        {hidden ? "••••" : `${tone === "red" ? "-" : ""}${formatMoney(value)}`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  period: { alignItems: "center", paddingVertical: 14 },
  periodText: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  hero: { gap: 8 },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  heroKicker: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: "rgba(255,255,255,0.75)" },
  eye: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, backgroundColor: "rgba(255,255,255,0.15)" },
  net: { fontSize: 36, fontWeight: "700", color: "#ffffff" },
  increase: { fontSize: 14, color: "rgba(255,255,255,0.9)" },
  composition: { gap: 16, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  donut: { alignSelf: "center", width: 144, height: 144, alignItems: "center", justifyContent: "center", borderRadius: RADIUS_FULL, borderWidth: 14, borderTopColor: "#2563eb", borderRightColor: "#712ae2", borderBottomColor: colors.success, borderLeftColor: colors.error },
  donutInner: { alignItems: "center" },
  donutCaption: { fontSize: 12, color: colors.onSurfaceVariant },
  donutValue: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  legendItem: { width: "50%", flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: RADIUS_FULL },
  legendLabel: { fontSize: 13, color: colors.onSurfaceVariant },
  lines: { gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  lineIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  lineCopy: { flex: 1 },
  lineTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  lineSub: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  lineValue: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 12 },
  secondaryAction: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingVertical: 14 },
  secondaryText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  primaryAction: { flex: 1, alignItems: "center", borderRadius: 12, backgroundColor: colors.primaryContainer, paddingVertical: 14 },
  primaryText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
});
