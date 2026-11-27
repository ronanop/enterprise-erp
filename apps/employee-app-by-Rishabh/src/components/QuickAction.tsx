import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { elevation } from "@/theme/elevation";
import { RADIUS_QUICK, text } from "@/theme/tokens";

/**
 * Tone lock — single blue accent family.
 * `mint` / `sand` are soft semantic tints (success / time), not competing accents.
 */
export type QuickTone =
  | "default"
  | "primary"
  | "violet"
  | "emerald"
  | "amber"
  | "mint"
  | "sand";

const TONES: Record<
  QuickTone,
  { colors: readonly [string, string]; fg: string; border: string }
> = {
  default: {
    colors: ["#FFFFFF", "#EEF3FC"],
    fg: colors.primary,
    border: "rgba(255,255,255,0.9)",
  },
  primary: {
    colors: ["#2563EB", "#3B82F6"],
    fg: "#FFFFFF",
    border: "rgba(255,255,255,0.28)",
  },
  // Legacy aliases → blue-family soft tiles (no purple accent).
  violet: {
    colors: ["#FFFFFF", "#EAF0FB"],
    fg: colors.primary,
    border: "rgba(255,255,255,0.9)",
  },
  emerald: {
    colors: ["#F0FDF7", "#E6F7F0"],
    fg: colors.tertiary,
    border: "rgba(255,255,255,0.9)",
  },
  amber: {
    colors: ["#FFFBEB", "#FEF3C7"],
    fg: colors.warning,
    border: "rgba(255,255,255,0.9)",
  },
  mint: {
    colors: ["#F0FDF7", "#E6F7F0"],
    fg: colors.tertiary,
    border: "rgba(255,255,255,0.9)",
  },
  sand: {
    colors: ["#FFFBEB", "#FEF3C7"],
    fg: colors.warning,
    border: "rgba(255,255,255,0.9)",
  },
};

export function quickToneColor(tone: QuickTone): string {
  return TONES[tone].fg;
}

/**
 * Home / Hub quick action: soft tile above a compact label.
 * Sized for a 4-column grid.
 */
export function QuickAction({
  label,
  tone = "default",
  icon,
  onPress,
}: {
  label: string;
  tone?: QuickTone;
  icon: ReactNode;
  onPress: () => void;
}) {
  const t = TONES[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.tileShadow}>
        <LinearGradient
          colors={t.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tile, { borderColor: t.border }]}
        >
          {icon}
        </LinearGradient>
      </View>
      <Text style={text.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    padding: 4,
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  tileShadow: {
    width: "100%",
    maxWidth: 72,
    aspectRatio: 1,
    borderRadius: RADIUS_QUICK,
    borderCurve: "continuous",
    ...elevation("md"),
  },
  tile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_QUICK,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
    overflow: "hidden",
  },
});
