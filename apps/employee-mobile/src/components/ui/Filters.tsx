import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { IconSearch } from "@/components/icons";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";

/** Mirrors the PWA FilterChips: horizontally scrolling pill filters. */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt}
            onPress={() => onChange(opt)}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
          >
            <Text
              style={[
                styles.chipText,
                active ? styles.chipTextActive : styles.chipTextIdle,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Mirrors the PWA SearchField: rounded white bar with a leading magnifier. */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <IconSearch size={18} color={colors.outline} />
      <TextInput
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={styles.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(67,70,85,0.7)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  chip: {
    borderRadius: RADIUS_FULL,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surfaceLow },
  chipText: { fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: colors.onPrimary },
  chipTextIdle: { color: colors.onSurfaceVariant },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    padding: 0,
  },
});
