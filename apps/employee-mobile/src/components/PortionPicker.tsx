import { Pressable, StyleSheet, Text, View } from "react-native";

const OPTIONS = [
  { value: "full_day", label: "Full day" },
  { value: "first_half", label: "First half" },
  { value: "second_half", label: "Second half" },
] as const;

/** Mobile-safe portion control — mirrors web PortionPicker. */
export function PortionPicker({
  value,
  onChange,
  label = "Portion",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0 },
  label: { fontSize: 12, fontWeight: "600", color: "#434655" },
  row: { marginTop: 6, flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  chipOn: { borderColor: "#004ac6", backgroundColor: "#004ac6" },
  chipOff: { borderColor: "#c4c6d4", backgroundColor: "#ffffff" },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textAlign: "center",
    color: "#0b1c30",
  },
  chipTextOn: { color: "#ffffff" },
});
