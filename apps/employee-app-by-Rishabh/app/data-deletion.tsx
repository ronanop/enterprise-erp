import { Linking, StyleSheet, Text } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { AlertBox, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { env } from "@/utils/env";
import { colors } from "@/theme/colors";

function buildMailto(employeeCode?: string, email?: string) {
  const subject = encodeURIComponent("ESS account / data deletion request");
  const body = encodeURIComponent(
    [
      "Hello HR / iConnect Plus support,",
      "",
      "I request deletion of my Employee App login and eligible associated personal data.",
      "",
      `Full name:`,
      `Work email: ${email || ""}`,
      `Employee code: ${employeeCode || ""}`,
      `Company / organization:`,
      `App platform:`,
      `Reason (optional):`,
      "",
      "I understand that employment or payroll records may be retained where required by law or my employer.",
      "",
      "Thank you.",
    ].join("\n"),
  );
  return `mailto:${env.supportEmail}?subject=${subject}&body=${body}`;
}

/**
 * Apple 5.1.1(v) / Google Play account deletion web+in-app path.
 * No form collection — opens the user's mail app with a template.
 */
export default function DataDeletionScreen() {
  const { me } = useAuth();

  async function emailRequest() {
    const mailto = buildMailto(me?.employee_code, me?.email);
    try {
      await Linking.openURL(mailto);
    } catch {
      await Linking.openURL(`mailto:${env.supportEmail}`);
    }
  }

  async function openWebPage() {
    await Linking.openURL(env.dataDeletionUrl);
  }

  return (
    <Screen
      scroll
      header={<SubHeader title="Request data deletion" />}
      contentStyle={styles.content}
    >
      <AlertBox tone="warn">
        Accounts are created by your employer (no in-app registration). Use this
        screen to request deletion of your Employee App login and eligible
        personal data. HR completes the deletion; some employment or payroll
        records may be retained where required by law.
      </AlertBox>

      <Card style={styles.card}>
        <Text style={styles.label}>Signed-in account</Text>
        <Text style={styles.value}>{me?.email || "—"}</Text>
        <Text style={styles.value}>Code: {me?.employee_code || "—"}</Text>

        <Button
          title="Request account deletion"
          onPress={() => void emailRequest()}
        />
        <Button
          title="Open web deletion instructions"
          variant="secondary"
          onPress={() => void openWebPage()}
        />
        <Text style={styles.hint}>
          In-app request emails {env.supportEmail}. Web form:{" "}
          {env.dataDeletionUrl}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 12 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  value: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  hint: { fontSize: 12, color: colors.outline, textAlign: "center" },
});
