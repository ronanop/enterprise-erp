import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { RADIUS_INPUT, text, tokens } from "@/theme/tokens";

type AlertTone = "danger" | "success" | "warn";

const TONES: Record<AlertTone, { bg: string; fg: string; border: string }> = {
  danger: { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" },
  success: { bg: "#ecfdf5", fg: "#064e3b", border: "#a7f3d0" },
  warn: { bg: "#fffbeb", fg: "#78350f", border: "#fde68a" },
};

/** Mirrors the PWA AlertBox. */
export function AlertBox({
  tone = "danger",
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.text, { color: t.fg }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Mirrors the PWA FieldRow: label left, bold value right. */
export function FieldRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={[tokens.listRow, styles.fieldRow]}>
      <Text style={text.muted}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value || "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: RADIUS_INPUT,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  fieldRow: { justifyContent: "space-between" },
  fieldValue: {
    maxWidth: "62%",
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
    color: colors.onSurface,
  },
});
