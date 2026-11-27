/** iConnect+ ESS — cool-grey canvas, single blue accent. */

export const colors = {
  background: "#F4F6FA",
  surface: "#F4F6FA",
  surfaceLowest: "#FFFFFF",
  surfaceLow: "#EEF1F7",
  surfaceContainer: "#E6EAF2",
  surfaceHigh: "#DDE3EE",
  surfaceHighest: "#D3DBE8",
  onSurface: "#0A1628",
  onSurfaceVariant: "#5A6478",
  outline: "#7A8499",
  outlineVariant: "#C8CEDC",
  primary: "#0B57D0",
  primaryContainer: "#2563EB",
  onPrimary: "#FFFFFF",
  primaryFixed: "#D6E3FF",
  primaryMuted: "rgba(11,87,208,0.10)",
  secondary: "#3D4A63",
  secondaryContainer: "#E8ECF4",
  tertiary: "#0B7A52",
  tertiaryContainer: "#0D9463",
  success: "#0D9463",
  warning: "#B45309",
  error: "#BA1A1A",
  errorContainer: "#FFDAD6",
  border: "#D8DEE9",
  /** Soft wash behind hero cards / login */
  canvasTint: "#EAF0FB",
  /** Login / brand accent — same family as primary (not a second hue). */
  loginAccent: "#2563EB",
} as const;

/** 4-pt spacing rhythm. Prefer gap over stacked margins. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/**
 * Shape lock:
 * - actions / nav: pills (full)
 * - cards / sheets: 20
 * - inputs / tiles: 14
 * - icon wells: 12
 */
export const radii = {
  xs: 8,
  sm: 12,
  md: 14,
  lg: 20,
  xl: 24,
  full: 999,
} as const;
