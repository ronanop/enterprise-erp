import { StyleSheet } from "react-native";
import { colors } from "./colors";

/**
 * React Native mirror of the PWA design tokens
 * (apps/employee-app/src/theme/classes.ts). Values are kept 1:1 so both
 * clients render the same surfaces, spacing, radii and shadows.
 */

/** rounded-2xl */
export const RADIUS_CARD = 16;
/** rounded-xl */
export const RADIUS_INPUT = 12;
/** rounded-full */
export const RADIUS_FULL = 999;
/** rounded-[1.15rem] */
export const RADIUS_QUICK = 18.4;

/**
 * Elevated surfaces must stay opaque. Android paints `elevation` as an opaque
 * rectangle behind the view, so a translucent fill lets that square bleed
 * through the rounded corners as a visible white box.
 */
export const CARD_SURFACE = colors.surfaceLowest;

/** Content gutter: px-5 */
export const GUTTER = 20;
/** Bottom nav clearance: pb-28 */
export const TAB_CLEARANCE = 112;
/** Header height: h-14 */
export const HEADER_HEIGHT = 56;
/** BottomNav height excluding the home-indicator inset. */
export const NAV_HEIGHT = 64;

export const tokens = StyleSheet.create({
  /** ui.card — rounded-2xl bg-white/80 shadow border outlineVariant/30 */
  card: {
    borderRadius: RADIUS_CARD,
    backgroundColor: CARD_SURFACE,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  /** ui.cardFlush — card with overflow hidden, no inner padding */
  cardFlush: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: CARD_SURFACE,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  /** ui.cardSoft — tinted surface card */
  cardSoft: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.2)",
  },

  /** ui.cardPeach — gradient handled by LinearCard; this is the shadow shell */
  cardPeach: {
    borderRadius: RADIUS_CARD,
    overflow: "hidden",
    shadowColor: "#2563eb",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  /** ui.btn — primary pill */
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 18.4,
    paddingVertical: 13.6,
    shadowColor: "#2563eb",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  /** ui.btnPunchOut — soft blue pill */
  btnPunchOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 18.4,
    paddingVertical: 13.6,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.4)",
  },

  /** ui.btnSecondary — white outlined pill */
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_FULL,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 18.4,
    paddingVertical: 13.6,
  },

  /** ui.btnLogout — red rounded rect */
  btnLogout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 18.4,
    paddingVertical: 13.6,
  },

  /** ui.btnGhost — small tinted pill */
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: RADIUS_FULL,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  /** ui.input */
  input: {
    width: "100%",
    borderRadius: RADIUS_INPUT,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 15.2,
    paddingVertical: 13.6,
    color: colors.onSurface,
    fontSize: 15,
  },

  inputFocused: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surfaceLowest,
  },

  /** ui.listRow */
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  /** ui.iconTile — h-9 w-9 rounded-xl */
  iconTile: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_INPUT,
    backgroundColor: colors.surfaceHigh,
  },

  /** ui.quickIcon */
  quickIcon: {
    aspectRatio: 1,
    maxWidth: 68,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_CARD,
    backgroundColor: colors.surfaceHigh,
  },

  /** ui.quickIconPremium — glass tile */
  quickIconPremium: {
    aspectRatio: 1,
    maxWidth: 76,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_QUICK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "#f5f8ff",
    shadowColor: "#2563eb",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  /** ui.quickPill */
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: CARD_SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  /** ui.glassNav — sticky header / bottom nav surface */
  glassNav: {
    backgroundColor: colors.background,
    borderColor: "rgba(195,198,215,0.3)",
  },
});

export const text = StyleSheet.create({
  /** h1 on PageHeader — text-[1.65rem] font-bold */
  pageTitle: {
    fontSize: 26.4,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.onSurface,
  },
  /** header title — text-lg font-bold */
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.onSurface,
  },
  /** SectionLabel h2 — text-lg font-semibold */
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.onSurface,
  },
  /** ui.sectionTitle — 0.72rem bold uppercase tracking-[0.08em] */
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.92,
    color: colors.onSurfaceVariant,
  },
  body: { fontSize: 14, color: colors.onSurface },
  muted: { fontSize: 14, color: colors.onSurfaceVariant },
  mutedSm: { fontSize: 12, color: colors.onSurfaceVariant },
  /** ui.quickLabel — compact quick-action caption */
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    letterSpacing: 0.2,
    textAlign: "center",
    color: colors.onSurfaceVariant,
  },
  /** button label */
  btnLabel: { fontSize: 15, fontWeight: "600", color: colors.onPrimary },
  btnLabelDark: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  btnLabelPrimary: { fontSize: 15, fontWeight: "600", color: colors.primary },
});

/** Gradient stops used across the app (net pay card, avatar, brand). */
export const gradients = {
  brand: ["#2563eb", "#712ae2"] as const,
  primaryTile: ["#2563eb", "#6366f1"] as const,
  progress: ["#2563eb", "#4f46e5", "#712ae2"] as const,
};
