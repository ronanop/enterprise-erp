import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, radii } from "@/theme/colors";

type Props = {
  value: Date | null;
  onChange: (next: Date | null) => void;
  minimumDate?: Date;
  disabled?: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDeadlineLabel(d: Date | null): string {
  if (!d) return "Pick date & time";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Calendar + clock deadline picker (native popup on iOS/Android; web datetime-local). */
export function DeadlineDateTimePicker({
  value,
  onChange,
  minimumDate,
  disabled,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidMode, setAndroidMode] = useState<"date" | "time" | null>(null);
  const draft = useMemo(() => value ?? new Date(), [value]);

  function openNative() {
    if (disabled) return;
    if (Platform.OS === "ios") {
      setIosOpen(true);
      return;
    }
    setAndroidMode("date");
  }

  function onAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === "dismissed") {
      setAndroidMode(null);
      return;
    }
    const next = selected ?? draft;
    if (androidMode === "date") {
      const merged = new Date(draft);
      merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
      onChange(merged);
      setAndroidMode("time");
      return;
    }
    const merged = new Date(draft);
    merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
    onChange(merged);
    setAndroidMode(null);
  }

  function onIosChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) onChange(selected);
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <TextInput
          value={value ? toLocalInputValue(value) : ""}
          onChangeText={(text) => {
            if (!text.trim()) {
              onChange(null);
              return;
            }
            const d = new Date(text);
            if (!Number.isNaN(d.getTime())) onChange(d);
          }}
          placeholder="YYYY-MM-DDTHH:mm"
          placeholderTextColor={colors.outline}
          style={styles.input}
          editable={!disabled}
          {...({ type: "datetime-local" } as object)}
        />
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            disabled={disabled}
            style={styles.clear}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openNative}
        disabled={disabled}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {formatDeadlineLabel(value)}
        </Text>
        <Text style={styles.fieldHint}>Calendar · Clock</Text>
      </Pressable>
      {value ? (
        <Pressable
          onPress={() => onChange(null)}
          disabled={disabled}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}

      {Platform.OS === "android" && androidMode ? (
        <DateTimePicker
          value={draft}
          mode={androidMode}
          display="default"
          minimumDate={minimumDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={iosOpen} transparent animationType="slide">
          <View style={styles.iosBackdrop}>
            <View style={styles.iosSheet}>
              <View style={styles.iosTop}>
                <Pressable onPress={() => setIosOpen(false)}>
                  <Text style={styles.iosBtn}>Done</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(null);
                    setIosOpen(false);
                  }}
                >
                  <Text style={[styles.iosBtn, { color: colors.error }]}>
                    Clear
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="spinner"
                minimumDate={minimumDate}
                onChange={onIosChange}
                style={{ alignSelf: "center" }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceLowest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.onSurface },
  placeholder: { color: colors.outline, fontWeight: "500" },
  fieldHint: { fontSize: 11, fontWeight: "700", color: colors.primary },
  clear: { alignSelf: "flex-start", paddingVertical: 2 },
  clearText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: "600" },
  iosBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iosSheet: {
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iosBtn: { color: colors.primary, fontWeight: "700", fontSize: 16 },
});
