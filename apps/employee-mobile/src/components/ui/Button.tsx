import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/** Variants map 1:1 to the PWA button classes in theme/classes.ts. */
type Variant = "primary" | "secondary" | "danger" | "ghost" | "punchOut";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: Variant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const BASE: Record<Variant, ViewStyle> = {
  primary: tokens.btn,
  secondary: tokens.btnSecondary,
  danger: tokens.btnLogout,
  ghost: tokens.btnGhost,
  punchOut: tokens.btnPunchOut,
};

export function Button({
  title,
  loading,
  variant = "primary",
  icon,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === "primary" ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        BASE[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        isDisabled && variant === "primary" ? styles.noShadow : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={labels[variant]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  noShadow: { shadowOpacity: 0, elevation: 0 },
  icon: { marginRight: 2 },
});

const labels = StyleSheet.create({
  primary: { fontSize: 15, fontWeight: "600", color: colors.onPrimary },
  secondary: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  danger: { fontSize: 15, fontWeight: "700", color: colors.error },
  ghost: { fontSize: 12.8, fontWeight: "600", color: colors.primary },
  punchOut: { fontSize: 15, fontWeight: "600", color: colors.primary },
});
