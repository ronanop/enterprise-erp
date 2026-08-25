/**
 * Premium Neo-Brutalist HRMS palette.
 * CSS tokens live on `.hrms-theme` (see globals.css); these constants are for
 * charts, KPI surfaces, and other JS-driven color picks.
 */

export const HRMS_COLORS = {
  primary: "#9B5BB8",
  background: "#FAFAFA",
  card: "#FFFFFF",
  text: "#0A0A0A",
  muted: "#666666",
  border: "#EAEAEA",
  lavender: "#F4EDFB",
  mint: "#ECFDF5",
  peach: "#FFFBEA",
  blue: "#EEF6FF",
  pink: "#FFF2F2",
  success: "#00A866",
  warning: "#FF8904",
  danger: "#FF2057",
  info: "#155DFD",
  teal: "#00BBAA",
  chartGreen: "#01BD7E",
  darkBg: "#0A0A0A",
  darkCard: "#282828",
  darkText: "#FFFFFF",
  darkMuted: "#AEB6C3",
} as const;

export const HRMS_CHART_COLORS = [
  HRMS_COLORS.primary,
  HRMS_COLORS.teal,
  HRMS_COLORS.chartGreen,
  HRMS_COLORS.warning,
  HRMS_COLORS.info,
  HRMS_COLORS.danger,
] as const;

export const HRMS_FUNNEL_COLORS = [
  HRMS_COLORS.primary,
  HRMS_COLORS.teal,
  HRMS_COLORS.chartGreen,
  HRMS_COLORS.warning,
  HRMS_COLORS.info,
] as const;

export const HRMS_CHART_STROKES = {
  purple: HRMS_COLORS.primary,
  teal: HRMS_COLORS.teal,
  green: HRMS_COLORS.chartGreen,
  orange: HRMS_COLORS.warning,
  blue: HRMS_COLORS.info,
} as const;

export const HRMS_KPI_SURFACES = [
  "bg-hrms-lavender",
  "bg-hrms-mint",
  "bg-hrms-peach",
  "bg-hrms-blue",
  "bg-hrms-pink",
] as const;

export function hrmsPastelSurface(index: number): string {
  return HRMS_KPI_SURFACES[index % HRMS_KPI_SURFACES.length]!;
}
