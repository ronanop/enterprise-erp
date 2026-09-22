import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { text, tokens } from "@/theme/tokens";

/** Mirrors the PWA StatTile: label + optional icon tile, big value, hint. */
export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <View style={[tokens.card, styles.wrap]}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <View style={tokens.iconTile}>{icon}</View> : null}
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {hint ? <Text style={text.mutedSm}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  value: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
});
