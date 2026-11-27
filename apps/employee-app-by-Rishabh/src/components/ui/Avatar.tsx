import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { elevation } from "@/theme/elevation";
import { gradients } from "@/theme/tokens";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: number; font: number }> = {
  sm: { box: 40, font: 14 },
  md: { box: 48, font: 16 },
  lg: { box: 64, font: 20 },
  xl: { box: 96, font: 30 },
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function Avatar({
  name,
  size = "md",
  ring = false,
  style,
}: {
  name: string;
  size?: Size;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { box, font } = SIZES[size];

  return (
    <View
      style={[
        {
          width: box,
          height: box,
          borderRadius: box / 2,
        },
        ring ? styles.ring : null,
        styles.shadow,
        style,
      ]}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: box / 2 }]}
      >
        <Text style={[styles.initials, { fontSize: font }]}>
          {initialsOf(name)}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  initials: { color: "#ffffff", fontWeight: "700", letterSpacing: -0.2 },
  ring: {
    borderWidth: 2,
    borderColor: colors.primaryFixed,
  },
  shadow: elevation("sm"),
});
