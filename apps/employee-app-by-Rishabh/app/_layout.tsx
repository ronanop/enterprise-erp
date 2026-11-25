import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { WebDeviceFrame } from "@/components/WebDeviceFrame";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hideAsync();
    }
  }, [status]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="data-deletion" />
        <Stack.Screen name="lock" />
        <Stack.Screen name="login" />
        <Stack.Screen name="force-change-password" />
        <Stack.Screen name="face-verify" />
        <Stack.Screen name="approvals" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="announcements" />
        <Stack.Screen name="performance" />
        <Stack.Screen name="training" />
        <Stack.Screen name="timesheet" />
        <Stack.Screen name="roster" />
        <Stack.Screen name="offline" />
        <Stack.Screen name="separation" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="compliance" />
        <Stack.Screen name="support" />
        <Stack.Screen name="rooms" />
        <Stack.Screen name="assets" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <WebDeviceFrame>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </WebDeviceFrame>
  );
}
