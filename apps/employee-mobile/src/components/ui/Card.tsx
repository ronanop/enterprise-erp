import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { gradients, tokens } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  /** `flush` removes padding for edge-to-edge list cards (PWA cardFlush). */
  variant?: "default" | "flush" | "soft";
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = "default", style }: Props) {
  const base =
    variant === "flush"
      ? tokens.cardFlush
      : variant === "soft"
        ? tokens.cardSoft
        : tokens.card;

  return (
    <View style={[base, variant === "default" ? styles.cardPad : null, style]}>
      {children}
    </View>
  );
}

/** PWA cardPeach — gradient hero card used for net pay / celebrations. */
export function GradientCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[tokens.cardPeach, style]}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPad}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardPad: { padding: 16 },
  // PWA cardPeach uses p-5; gradient heroes retain that 20px rhythm.
  heroPad: { padding: 20 },
});
