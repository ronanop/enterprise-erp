import { StyleSheet, Text, View } from "react-native";
import { RADIUS_FULL } from "@/theme/tokens";

export type Tone = "neutral" | "success" | "warn" | "danger" | "info";

/** Mirrors the PWA `leaveStatusTone` mapping. */
export function leaveStatusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["approved", "paid", "issued", "active", "present", "complete"].includes(s)) {
    return "success";
  }
  if (["submitted", "draft", "pending"].includes(s)) return "warn";
  if (["rejected", "cancelled", "locked", "absent"].includes(s)) return "danger";
  return "info";
}

const DARK: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "#eff4ff", fg: "#434655" },
  success: { bg: "#d1fae5", fg: "#065f46" },
  warn: { bg: "#fef3c7", fg: "#92400e" },
  danger: { bg: "#ffdad6", fg: "#ba1a1a" },
  info: { bg: "#dbe1ff", fg: "#004ac6" },
};

const LIGHT: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "rgba(255,255,255,0.7)", fg: "#0b1c30" },
  success: { bg: "#059669", fg: "#ffffff" },
  warn: { bg: "#f59e0b", fg: "#ffffff" },
  danger: { bg: "#ba1a1a", fg: "#ffffff" },
  info: { bg: "#2563eb", fg: "#ffffff" },
};

export function StatusBadge({
  status,
  tone = "neutral",
  onLight = false,
}: {
  status: string;
  tone?: Tone;
  onLight?: boolean;
}) {
  const { bg, fg } = (onLight ? LIGHT : DARK)[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS_FULL,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
