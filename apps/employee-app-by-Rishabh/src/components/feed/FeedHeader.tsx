import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NotificationBell } from "@/components/AppHeader";
import { IconPlus } from "@/components/icons";
import { colors } from "@/theme/colors";
import { GUTTER, HEADER_HEIGHT } from "@/theme/tokens";

const INK = colors.onSurface;

type Props = {
  onCreate: () => void;
  unreadCount?: number;
};

/** Feed top bar: create (+) · centered iConnect+ · notifications. */
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
          <View style={styles.createWell}>
            <IconPlus size={20} color={colors.primary} />
          </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(200,206,220,0.4)",
    backgroundColor: colors.surfaceLowest,
    ...Platform.select({
      web: {
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        backgroundColor: "rgba(255,255,255,0.92)",
      } as object,
      default: {},
    }),
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
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: INK,
  },
  iconBtn: {
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
  createWell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
