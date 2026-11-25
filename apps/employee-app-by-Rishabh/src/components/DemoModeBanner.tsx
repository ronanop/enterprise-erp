import { StyleSheet, Text, View } from "react-native";
import { env } from "@/utils/env";
import { colors } from "@/theme/colors";

/** Store / reviewer disclosure when the app runs on mock / demo data. */
export function DemoModeBanner() {
  if (!env.useMock) return null;
  return (
    <View style={styles.bar} accessibilityRole="summary">
      <Text style={styles.text}>
        Demo mode — sample data only. Not connected to live ERP / HRMS.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#fff7ed",
    borderBottomWidth: 1,
    borderBottomColor: "#fed7aa",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#9a3412",
  },
});
