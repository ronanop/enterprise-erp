import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

/** Matches the PWA `input` class, including the focus surface swap. */
export function TextField({ label, hint, style, accessibilityLabel, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor="rgba(67,70,85,0.7)"
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[tokens.input, focused ? tokens.inputFocused : null, style]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  hint: { fontSize: 12, color: colors.onSurfaceVariant },
});
