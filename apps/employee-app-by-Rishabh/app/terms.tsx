import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Card, Screen } from "@/components/ui";
import { env } from "@/utils/env";
import { colors } from "@/theme/colors";

export default function TermsScreen() {
  return (
    <Screen scroll header={<SubHeader title="Terms of Use" />} contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.body}>
          {env.appName} is provided for authorized employees and managers of
          your organization. You must use your assigned credentials, keep them
          confidential, and use the app only for legitimate workplace purposes.
        </Text>
        <Text style={styles.body}>
          Location, camera, and notification access are optional at the OS
          level but required for the specific features that need them
          (attendance punch, face verification, alerts). Misuse may result in
          access being revoked by your employer.
        </Text>
        <Pressable onPress={() => void Linking.openURL(env.termsUrl)}>
          <Text style={styles.link}>Open full Terms of Use</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 12 },
  body: { fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant },
  link: { fontSize: 14, fontWeight: "600", color: colors.primary },
});
