import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconBack, IconBell } from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { colors } from "@/theme/colors";
import { GUTTER, HEADER_HEIGHT, text } from "@/theme/tokens";

/** Notification bell — numeric badge or Instagram-style red dot. */
export function NotificationBell({
  count = 0,
  color = colors.onSurface,
  indicator = "count",
}: {
  count?: number;
  color?: string;
  /** `dot` = small red unread mark (feed); `count` = numeric badge. */
  indicator?: "count" | "dot";
}) {
  const router = useRouter();
  const hasUnread = count > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread ? `Notifications, ${count} unread` : "Notifications"
      }
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
    >
      <IconBell size={22} color={color} />
      {hasUnread && indicator === "dot" ? <View style={styles.dot} /> : null}
      {hasUnread && indicator === "count" ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Sticky header: avatar → profile, brand title, notification bell.
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
          style={({ pressed }) => [pressed && styles.pressed]}
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
 * Sub-header: back chevron + page title, optional right slot.
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
    router.replace("/(tabs)/feed");
  }

  return (
    <View style={styles.header}>
      <View style={styles.leftTight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(200,206,220,0.45)",
    backgroundColor: colors.background,
    ...Platform.select({
      web: {
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        backgroundColor: "rgba(244,246,250,0.88)",
      } as object,
      default: {},
    }),
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  leftTight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  brandTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: colors.onSurface,
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
    borderRadius: 20,
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  pressed: { opacity: 0.7 },
  badge: {
    position: "absolute",
    right: 2,
    top: 2,
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
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
  dot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
