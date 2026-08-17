import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";

/** Initial bootstrap — wait for auth, then show the branded app splash. */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href="/splash" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
