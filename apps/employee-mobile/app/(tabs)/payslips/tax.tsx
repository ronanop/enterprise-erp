import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconChevronRight, IconDownload, IconWallet } from "@/components/icons";
import { Button, Card, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { formatMoney } from "@/utils/datetime";

export default function TaxBenefitsScreen() {
  const router = useRouter();
  const [latest, setLatest] = useState<EssPayslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      essService
        .payslips()
        .then((res) => {
          setLatest((res.data ?? [])[0] ?? null);
          setError(null);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load tax info",
          ),
        );
    }, []),
  );

  const net = Number(latest?.net_salary) || 0;
  const gross = Number(latest?.gross_salary) || 0;
  const percent = Math.min(100, Math.round((net / Math.max(gross, 1)) * 100));

  return (
    <Screen scroll header={<SubHeader title="Tax & Benefits" />} contentStyle={styles.content}>
      <Text style={styles.financialYear}>FY 2025-26</Text>
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <Card style={styles.takeHome}>
        <View style={styles.takeHomeTop}>
          <View>
            <Text style={styles.kicker}>Projected Net Take-Home</Text>
            <Text style={styles.net}>
              {formatMoney(net)}
              <Text style={styles.perMonth}>/mo</Text>
            </Text>
          </View>
          <View style={styles.wallet}>
            <IconWallet size={18} color={colors.primary} />
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.hint}>
          {percent}% of gross salary after taxes & deductions
        </Text>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Portfolio</Text>
        <Portfolio
          title="Income Tax"
          subtitle="Estimated annual tax: ₹1,42,000"
          badge="Verified"
          badgeTone="green"
        />
        <Portfolio
          title="Provident Fund"
          subtitle="Current Balance: ₹2,84,500"
          badge="Active"
          badgeTone="blue"
        />
        <Portfolio
          title="Insurance"
          subtitle="Premium coverage for family"
          badge="3 Plans"
          badgeTone="blue"
        />
        <Portfolio
          title="Retirement Benefits"
          subtitle="Vesting starts in 14 months"
          badge="View details"
          badgeTone="plain"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <Card style={styles.document}>
          <Text style={styles.documentTitle}>Download Tax Certificate</Text>
          <Text style={styles.documentCopy}>
            Your Form 16 and Tax summary for Q3 are now ready for download
          </Text>
          <Button
            title="Download PDF (2.4 MB)"
            icon={<IconDownload size={16} color="#ffffff" />}
            onPress={() => router.push("/documents")}
          />
        </Card>
      </View>
    </Screen>
  );
}

function Portfolio({
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "green" | "blue" | "plain";
}) {
  return (
    <Pressable style={styles.portfolio}>
      <View style={styles.wallet}>
        <IconWallet size={18} color={colors.primary} />
      </View>
      <View style={styles.portfolioCopy}>
        <Text style={styles.portfolioTitle}>{title}</Text>
        <Text style={styles.portfolioSub}>{subtitle}</Text>
      </View>
      {badgeTone === "plain" ? (
        <Text style={styles.plainBadge}>{badge}</Text>
      ) : (
        <Text
          style={[
            styles.badge,
            badgeTone === "green" ? styles.greenBadge : styles.blueBadge,
          ]}
        >
          {badge}
        </Text>
      )}
      <IconChevronRight size={16} color={colors.outlineVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 20 },
  financialYear: { marginTop: -8, fontSize: 14, color: colors.onSurfaceVariant },
  takeHome: { gap: 12, padding: 20 },
  takeHomeTop: { flexDirection: "row", justifyContent: "space-between" },
  kicker: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, color: colors.onSurfaceVariant },
  net: { marginTop: 4, fontSize: 30, fontWeight: "700", color: colors.primary },
  perMonth: { fontSize: 16, fontWeight: "500", color: colors.onSurfaceVariant },
  wallet: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primaryFixed },
  track: { height: 8, overflow: "hidden", borderRadius: RADIUS_FULL, backgroundColor: "#d3e4fe" },
  fill: { height: "100%", borderRadius: RADIUS_FULL, backgroundColor: colors.primary },
  hint: { fontSize: 14, color: colors.onSurfaceVariant },
  section: { gap: 8 },
  sectionTitle: { marginBottom: 4, fontSize: 18, fontWeight: "600", color: colors.onSurface },
  portfolio: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: colors.surface, padding: 16, shadowColor: "#0b1c30", shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 },
  portfolioCopy: { flex: 1 },
  portfolioTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  portfolioSub: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  badge: { overflow: "hidden", borderRadius: RADIUS_FULL, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "700" },
  blueBadge: { backgroundColor: colors.primaryFixed, color: colors.primary },
  greenBadge: { backgroundColor: "#d1fae5", color: "#065f46" },
  plainBadge: { fontSize: 12, fontWeight: "600", color: colors.primary },
  document: { alignItems: "center", gap: 10, borderWidth: 1, borderStyle: "dashed", borderColor: colors.outlineVariant, backgroundColor: colors.surfaceLow, padding: 20 },
  documentTitle: { fontSize: 15, fontWeight: "600", color: colors.primary },
  documentCopy: { textAlign: "center", fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
});
