import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const { status, me } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === "signedOut") {
    return <Redirect href="/login" />;
  }

  if (me?.must_change_password) {
    return <Redirect href="/force-change-password" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        // Instant scene swap — pill spring handles the motion.
        animation: "none",
        lazy: false,
        // Let scenes fill the viewport; BottomNav floats over content.
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: "Feed" }} />
      <Tabs.Screen name="task" options={{ title: "Task" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="hub" options={{ title: "Hub" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* Hidden from bottom nav — still reachable via Hub / deep links. */}
      <Tabs.Screen name="home" options={{ title: "Home", href: null }} />
      <Tabs.Screen name="leave" options={{ title: "Leave", href: null }} />
      <Tabs.Screen name="payslips" options={{ title: "Salary", href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
