import { Platform, StyleSheet } from "react-native";
import { colors, radii } from "./colors";
import { elevation } from "./elevation";

/**
 * Shared surface / control tokens.
 * Shape lock: cards 20, inputs 14, actions pill, continuous corners.
 */

/** rounded card */
export const RADIUS_CARD = radii.lg;
/** rounded input / tile */
export const RADIUS_INPUT = radii.md;
/** rounded-full */
export const RADIUS_FULL = radii.full;
/** quick-action tile */
export const RADIUS_QUICK = 18;

/**
 * Elevated surfaces must stay opaque. Android paints `elevation` as an opaque
 * rectangle behind the view, so a translucent fill lets that square bleed
 * through the rounded corners as a visible white box.
 */
export const CARD_SURFACE = colors.surfaceLowest;

/** Content gutter */
export const GUTTER = 20;
/** Bottom nav clearance */
export const TAB_CLEARANCE = 112;
/** Header height */
export const HEADER_HEIGHT = 56;
/** BottomNav height excluding the home-indicator inset. */
export const NAV_HEIGHT = 64;

const continuous = Platform.OS === "ios" ? ({ borderCurve: "continuous" } as const) : {};

export const tokens = StyleSheet.create({
  card: {
    borderRadius: RADIUS_CARD,
    backgroundColor: CARD_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.55)",
    ...continuous,
    ...elevation("md"),
  },

  cardFlush: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: CARD_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.55)",
    ...continuous,
    ...elevation("md"),
  },

  cardSoft: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: colors.surfaceLow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.4)",
    ...continuous,
  },

  cardPeach: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    ...continuous,
    ...elevation("accent"),
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    ...elevation("accent"),
  },

  btnPunchOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.7)",
  },

  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.8)",
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },

  btnLogout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    ...continuous,
  },

  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  input: {
    width: "100%",
    borderRadius: RADIUS_INPUT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.85)",
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: 16,
    lineHeight: 22,
    ...continuous,
  },

  inputFocused: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surfaceLowest,
    ...elevation("sm"),
  },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(200,206,220,0.45)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  iconTile: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted,
    ...continuous,
  },

  quickIcon: {
    aspectRatio: 1,
    maxWidth: 68,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.surfaceHigh,
    ...continuous,
  },

  quickIconPremium: {
    aspectRatio: 1,
    maxWidth: 76,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_QUICK,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: colors.surfaceLowest,
    ...continuous,
    ...elevation("md"),
  },

  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: CARD_SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 14,
    ...continuous,
    ...elevation("sm"),
  },

  glassNav: {
    backgroundColor: colors.background,
    borderColor: "rgba(200,206,220,0.35)",
  },
});

export const text = StyleSheet.create({
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 34,
    color: colors.onSurface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.onSurface,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.onSurface,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.onSurfaceVariant,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.onSurface },
  muted: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  mutedSm: { fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    letterSpacing: 0.1,
    textAlign: "center",
    color: colors.onSurfaceVariant,
  },
  btnLabel: { fontSize: 15, fontWeight: "600", color: colors.onPrimary },
  btnLabelDark: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  btnLabelPrimary: { fontSize: 15, fontWeight: "600", color: colors.primary },
});

/** Single-accent brand gradients — blue family only. */
export const gradients = {
  brand: ["#0B57D0", "#2563EB"] as const,
  primaryTile: ["#2563EB", "#3B82F6"] as const,
  progress: ["#0B57D0", "#2563EB", "#60A5FA"] as const,
  heroWash: ["#EAF0FB", "#F4F6FA"] as const,
  softTile: ["#FFFFFF", "#F0F4FC"] as const,
};
