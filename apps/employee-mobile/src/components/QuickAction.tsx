import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS_QUICK, text } from "@/theme/tokens";

/** Matches the PWA quickIconPremium* variants in theme/classes.ts. */
export type QuickTone =
  | "default"
  | "primary"
  | "violet"
  | "emerald"
  | "amber";

const TONES: Record<
  QuickTone,
  { colors: readonly [string, string, string]; fg: string; shadow: string; border: string }
> = {
  default: {
    colors: ["#ffffff", "#f5f8ff", "#dce9ff"],
    fg: "#004ac6",
    shadow: "rgba(37,99,235,0.14)",
    border: "rgba(255,255,255,0.7)",
  },
  primary: {
    colors: ["#2563eb", "#3b6ef0", "#6366f1"],
    fg: "#ffffff",
    shadow: "rgba(37,99,235,0.38)",
    border: "rgba(255,255,255,0.25)",
  },
  violet: {
    colors: ["#f3edff", "#ffffff", "#eaddff"],
    fg: "#712ae2",
    shadow: "rgba(113,42,226,0.12)",
    border: "rgba(255,255,255,0.7)",
  },
  emerald: {
    colors: ["#ecfdf5", "#ffffff", "#d1fae5"],
    fg: "#007d55",
    shadow: "rgba(0,125,85,0.1)",
    border: "rgba(255,255,255,0.7)",
  },
  amber: {
    colors: ["#fffbeb", "#ffffff", "#fef3c7"],
    fg: "#b45309",
    shadow: "rgba(180,83,9,0.1)",
    border: "rgba(255,255,255,0.7)",
  },
};

export function quickToneColor(tone: QuickTone): string {
  return TONES[tone].fg;
}

/**
 * A single home-screen quick action: gradient icon well above a small label.
 * Sized to fit a 4-column grid like the PWA.
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
      <View
        style={[
          styles.tileShadow,
          { shadowColor: t.shadow.replace(/rgba?\(([^,]+,[^,]+,[^,]+).*/, "rgb($1)") },
        ]}
      >
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
    padding: 6,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  tileShadow: {
    width: "100%",
    maxWidth: 76,
    aspectRatio: 1,
    borderRadius: RADIUS_QUICK,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_QUICK,
    borderWidth: 1,
  },
});
