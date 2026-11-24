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
      "I understand that after approval, app login and eligible app-associated data may be removed, while employment / payroll / statutory records may be retained by my employer where required by law or HR policy.",
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
        We do not collect deletion requests in the app. Email HR with the
        template below. After approval we remove app login and eligible
        app-associated data. Employment, payroll, attendance, tax, KYC, and
        audit records may stay with your employer where law or HR policy
        requires it.
      </AlertBox>

      <Card style={styles.card}>
        <Text style={styles.label}>Signed-in account</Text>
        <Text style={styles.value}>{me?.email || "—"}</Text>
        <Text style={styles.value}>Code: {me?.employee_code || "—"}</Text>

        <Text style={styles.retainTitle}>Typically retained by employer</Text>
        <Text style={styles.retainBody}>
          Employee master, attendance / leave history, payslips &amp; tax
          registers, required KYC documents, and audit logs — see the web page
          for full wording.
        </Text>

        <Button title="Email deletion request" onPress={() => void emailRequest()} />
        <Button
          title="Open web instructions"
          variant="secondary"
          onPress={() => void openWebPage()}
        />
        <Text style={styles.hint}>Sends to {env.supportEmail}</Text>
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
  retainTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  retainBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceVariant,
  },
  hint: { fontSize: 12, color: colors.outline, textAlign: "center" },
});

