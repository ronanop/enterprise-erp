import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect, usePathname, useSegments } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { env } from "@/utils/env";
import { colors } from "@/theme/colors";

function isAllowedDuringCompliance(pathname: string, segments: string[]): boolean {
  const joined = segments.join("/");
  if (pathname.includes("compliance") || joined.includes("compliance")) {
    return true;
  }
  if (
    pathname.includes("change-password") ||
    joined.includes("change-password")
  ) {
    return true;
  }
  return false;
}

/** Mirrors web ComplianceGuard — force password / policy before ESS use. */
export function ComplianceGuard({ children }: { children: ReactNode }) {
  const { me, status } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();

  if (env.useMock || status === "loading" || status === "signedOut" || !me) {
    return <>{children}</>;
  }

  const allowed = isAllowedDuringCompliance(pathname, segments as string[]);
  const mustPassword = Boolean(me.must_change_password);
  const mustPolicy = (me.pending_policy_count ?? 0) > 0;

  if (!allowed && mustPassword) {
    return <Redirect href="/(tabs)/profile/change-password" />;
  }
  if (!allowed && mustPolicy) {
    return <Redirect href="/compliance" />;
  }

  return <>{children}</>;
}

export function ComplianceChecking() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.copy}>Checking compliance…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background,
  },
  copy: { fontSize: 14, fontWeight: "500", color: colors.onSurfaceVariant },
});
