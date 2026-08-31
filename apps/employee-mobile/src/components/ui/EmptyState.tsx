import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { RADIUS_CARD, RADIUS_INPUT } from "@/theme/tokens";

type Props = {
  title?: string;
  /** PWA calls this `description`; `message` kept for existing callers. */
  message?: string;
  description?: string;
  icon?: ReactNode;
};

/** Mirrors the PWA EmptyState: dashed card, optional icon tile, title + copy. */
export function EmptyState({
  title = "Nothing here yet",
  message,
  description,
  icon,
}: Props) {
  const copy = description ?? message;
  return (
    <View style={styles.box}>
      {icon ? <View style={styles.iconTile}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {copy ? <Text style={styles.message}>{copy}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(195,198,215,0.6)",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 36,
    alignItems: "center",
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  message: {
    marginTop: 4,
    maxWidth: 256,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.onSurfaceVariant,
  },
});

export function ErrorBox({ children }: { children: string }) {
  return (
    <View style={errorStyles.box}>
      <Text style={errorStyles.text}>{children}</Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  box: {
    borderRadius: RADIUS_INPUT,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: { color: "#991b1b", fontSize: 14, fontWeight: "500", lineHeight: 20 },
});
