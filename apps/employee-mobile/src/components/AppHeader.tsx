import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconBack, IconBell } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { colors } from "@/theme/colors";
import { GUTTER, HEADER_HEIGHT, text } from "@/theme/tokens";

/** PWA notificationBellButton + badge. */
export function NotificationBell({ count = 0 }: { count?: number }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      onPress={() => router.push("/notifications")}
      style={styles.bell}
    >
      <IconBell size={22} color={colors.primary} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Mirrors the PWA AppHeader: sticky glass bar with avatar (→ profile),
 * brand title in primary blue, and the notification bell.
 */
export function AppHeader({
  title = "Employee Portal",
  name,
  unreadCount = 0,
}: {
  title?: string;
  name?: string | null;
  unreadCount?: number;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Avatar name={name ?? ""} size="sm" ring />
        </Pressable>
        <Text style={styles.brandTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <NotificationBell count={unreadCount} />
    </View>
  );
}

/**
 * Mirrors the PWA SubHeader: back chevron + page title, with the bell
 * (or a caller-supplied node) on the right.
 */
export function SubHeader({
  title,
  right,
  name,
  unreadCount = 0,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  name?: string | null;
  unreadCount?: number;
  onBack?: () => void;
}) {
  const router = useRouter();

  function goBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) return router.back();
    router.replace("/(tabs)/home");
  }

  return (
    <View style={styles.header}>
      <View style={styles.leftTight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={styles.backBtn}
        >
          <IconBack size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={text.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right ??
        (name ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Avatar name={name} size="sm" ring />
          </Pressable>
        ) : (
          <NotificationBell count={unreadCount} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.3)",
    backgroundColor: "rgba(248,249,255,0.92)",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  leftTight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  brandTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  bell: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 2,
    top: 2,
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
});
