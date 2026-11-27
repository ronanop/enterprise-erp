import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/theme/colors";
import { elevation } from "@/theme/elevation";
import { RADIUS_CARD, RADIUS_INPUT } from "@/theme/tokens";

type Props = {
  title?: string;
  /** PWA calls this `description`; `message` kept for existing callers. */
  message?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/** Composed empty state: soft surface, icon well, title, copy, optional CTA. */
export function EmptyState({
  title = "Nothing here yet",
  message,
  description,
  icon,
  action,
}: Props) {
  const copy = description ?? message;
  return (
    <View style={styles.box}>
      {icon ? <View style={styles.iconWell}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {copy ? <Text style={styles.message}>{copy}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: RADIUS_CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.55)",
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    borderCurve: "continuous",
    ...elevation("sm"),
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderCurve: "continuous",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.onSurface,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: colors.onSurfaceVariant,
  },
  action: {
    marginTop: 20,
    width: "100%",
    maxWidth: 240,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderCurve: "continuous",
  },
  text: { color: "#991B1B", fontSize: 14, fontWeight: "500", lineHeight: 20 },
});
