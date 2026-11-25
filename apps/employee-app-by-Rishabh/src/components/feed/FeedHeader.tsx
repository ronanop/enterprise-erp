import { Pressable, StyleSheet, Text, View } from "react-native";
import { NotificationBell } from "@/components/AppHeader";
import { IconPlus } from "@/components/icons";
import { colors } from "@/theme/colors";
import { GUTTER, HEADER_HEIGHT } from "@/theme/tokens";

const INK = colors.onSurface;

type Props = {
  onCreate: () => void;
  unreadCount?: number;
};

/** Feed top bar: create (+) · centered iConnect+ text · notifications. */
export function FeedHeader({ onCreate, unreadCount = 0 }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create post"
          onPress={onCreate}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <IconPlus size={24} color={INK} />
        </Pressable>
      </View>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.brand} numberOfLines={1}>
          iConnect+
        </Text>
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <NotificationBell
          count={unreadCount}
          color={INK}
          indicator="dot"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.3)",
    backgroundColor: colors.background,
  },
  side: {
    width: 48,
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1,
  },
  sideRight: { alignItems: "flex-end" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: INK,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  pressed: { opacity: 0.7 },
});
