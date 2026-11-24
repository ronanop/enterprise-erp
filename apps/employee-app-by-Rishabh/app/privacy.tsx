import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Card, Screen } from "@/components/ui";
import { env } from "@/utils/env";
import { colors } from "@/theme/colors";

export default function PrivacyPolicyScreen() {
  return (
    <Screen scroll header={<SubHeader title="Privacy Policy" />} contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.title}>{env.appName}</Text>
        <Text style={styles.body}>
          This employee self-service app processes workplace data such as your
          profile, attendance punches (including precise location when you
          punch), leave requests, documents you upload, device push tokens, and
          optional camera images for verification.
        </Text>
        <Text style={styles.body}>
          Data is used to provide HR and ESS features for your employer, to
          secure your session, and to send work-related notifications. It is
          not sold for advertising.
        </Text>
        <Text style={styles.body}>
          Accounts are provisioned by your organization. To request deletion of
          your login or associated personal data, use Profile → Request account
          / data deletion, or visit the web page below. After an approved
          request we remove app login and eligible app-associated data.
          Employment master data, attendance / leave history, payslips, tax
          registers, required KYC documents, and audit logs may remain with your
          employer where law or HR policy requires it.
        </Text>
        <Pressable onPress={() => void Linking.openURL(env.privacyPolicyUrl)}>
          <Text style={styles.link}>Open full Privacy Policy</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(env.dataDeletionUrl)}>
          <Text style={styles.link}>Data deletion web form</Text>
        </Pressable>
        <Text style={styles.meta}>Support: {env.supportEmail}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  body: { fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant },
  link: { fontSize: 14, fontWeight: "600", color: colors.primary },
  meta: { fontSize: 12, color: colors.outline },
});
