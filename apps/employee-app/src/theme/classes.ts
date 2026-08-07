/** Kinetic Executive ESS — Stitch Luminary HR mobile palette */

export const colors = {
  background: "#f8f9ff",
  surface: "#f8f9ff",
  surfaceLowest: "#ffffff",
  surfaceLow: "#eff4ff",
  surfaceContainer: "#e5eeff",
  surfaceHigh: "#dce9ff",
  surfaceHighest: "#d3e4fe",
  onSurface: "#0b1c30",
  onSurfaceVariant: "#434655",
  outline: "#737686",
  outlineVariant: "#c3c6d7",
  primary: "#004ac6",
  primaryContainer: "#2563eb",
  onPrimary: "#ffffff",
  primaryFixed: "#dbe1ff",
  secondary: "#712ae2",
  secondaryContainer: "#8a4cfc",
  tertiary: "#006242",
  tertiaryContainer: "#007d55",
  success: "#10B981",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  border: "#E2E8F0",
} as const;

export const shell =
  "min-h-dvh bg-[#f8f9ff] text-[#0b1c30]";

export const shellPlain =
  "min-h-dvh bg-[#f8f9ff] text-[#0b1c30]";

export const card =
  "rounded-2xl bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[20px] border border-[#c3c6d7]/30";

export const cardFlush =
  "overflow-hidden rounded-2xl bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[20px] border border-[#c3c6d7]/30";

/** Soft tinted surface card (AI banner, secondary list items) */
export const cardSoft =
  "overflow-hidden rounded-2xl bg-[#eff4ff] border border-[#c3c6d7]/20";

/** High-impact gradient card (net pay / celebrations) */
export const cardPeach =
  "overflow-hidden rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#712ae2] text-white shadow-[0_10px_28px_rgba(37,99,235,0.28)]";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#2563eb] px-[1.15rem] py-[0.85rem] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition active:scale-[0.98] disabled:opacity-55 disabled:shadow-none hover:opacity-90";

export const btnOnPeach = btn;

export const btnPunchOut =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#eff4ff] px-[1.15rem] py-[0.85rem] font-semibold text-[#004ac6] border border-[#c3c6d7]/40 transition active:scale-[0.98] disabled:opacity-55";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#c3c6d7]/50 bg-white px-[1.15rem] py-[0.85rem] font-semibold text-[#0b1c30] transition active:scale-[0.98] disabled:opacity-55";

export const btnLogout =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ffdad6] px-[1.15rem] py-[0.85rem] font-bold text-[#ba1a1a] transition active:scale-[0.98] disabled:opacity-55 hover:bg-[#ffc4be]";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[#dce9ff] px-3.5 py-1.5 text-[0.8rem] font-semibold text-[#004ac6]";

export const btnPeach = btn;

export const input =
  "w-full rounded-xl border border-[#c3c6d7]/50 bg-[#eff4ff] px-[0.95rem] py-[0.85rem] text-[#0b1c30] outline-none placeholder:text-[#434655]/70 focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]";

export const inputOnLight = input;

export const sectionTitle =
  "text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#434655]";

export const muted = "text-[#434655]";

export const inkMuted = "text-[#434655]";

export const quick =
  "flex w-full flex-col items-center gap-2 text-center transition active:scale-[0.98]";

export const quickPremium =
  "group flex w-full flex-col items-center gap-2.5 rounded-2xl p-1.5 text-center transition active:scale-[0.96]";

export const quickIcon =
  "flex aspect-square w-full max-w-[4.25rem] items-center justify-center rounded-2xl bg-[#dce9ff] text-[#004ac6] shadow-sm";

export const quickIconActive =
  "flex aspect-square w-full max-w-[4.25rem] items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-md";

/** Glass + gradient icon well (premium quick actions) */
export const quickIconPremium =
  "flex aspect-square w-full max-w-[4.75rem] items-center justify-center rounded-[1.15rem] border border-white/70 bg-gradient-to-br from-white via-[#f5f8ff] to-[#dce9ff]/80 text-[#004ac6] shadow-[0_8px_22px_rgba(37,99,235,0.14)] ring-1 ring-[#c3c6d7]/25 backdrop-blur-sm";

export const quickIconPremiumViolet =
  "flex aspect-square w-full max-w-[4.75rem] items-center justify-center rounded-[1.15rem] border border-white/70 bg-gradient-to-br from-[#f3edff] via-white to-[#eaddff]/90 text-[#712ae2] shadow-[0_8px_22px_rgba(113,42,226,0.12)] ring-1 ring-[#c3c6d7]/25";

export const quickIconPremiumEmerald =
  "flex aspect-square w-full max-w-[4.75rem] items-center justify-center rounded-[1.15rem] border border-white/70 bg-gradient-to-br from-[#ecfdf5] via-white to-[#d1fae5]/80 text-[#007d55] shadow-[0_8px_22px_rgba(0,125,85,0.1)] ring-1 ring-[#c3c6d7]/25";

export const quickIconPremiumAmber =
  "flex aspect-square w-full max-w-[4.75rem] items-center justify-center rounded-[1.15rem] border border-white/70 bg-gradient-to-br from-[#fffbeb] via-white to-[#fef3c7]/90 text-[#b45309] shadow-[0_8px_22px_rgba(180,83,9,0.1)] ring-1 ring-[#c3c6d7]/25";

/** Primary CTA tile (e.g. Check In) */
export const quickIconPremiumPrimary =
  "flex aspect-square w-full max-w-[4.75rem] items-center justify-center rounded-[1.15rem] border border-white/25 bg-gradient-to-br from-[#2563eb] to-[#6366f1] text-white shadow-[0_12px_28px_rgba(37,99,235,0.38)] ring-1 ring-[#004ac6]/20";

export const quickLabel =
  "text-[10px] font-semibold leading-tight tracking-wide text-[#434655]";

export const quickPill =
  "flex items-center justify-center gap-2 rounded-2xl border border-white/55 bg-white/80 px-3 py-3.5 text-xs font-semibold text-[#004ac6] shadow-[0_6px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl transition active:scale-[0.98] ring-1 ring-[#c3c6d7]/20";

/** Header notifications — icon-only (no card), matches avatar row height */
export const notificationBellButton =
  "relative inline-flex h-10 w-10 shrink-0 items-center justify-center leading-none text-[#004ac6] transition active:scale-95";

export const notificationBellBadge =
  "absolute right-0 top-0 flex h-[18px] min-w-[18px] -translate-y-px translate-x-px items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#f8f9ff]";

export const listRow =
  "flex items-center gap-3.5 border-b border-[#c3c6d7]/25 px-4 py-3.5 last:border-b-0";

export const iconTile =
  "flex h-9 w-9 items-center justify-center rounded-xl bg-[#dce9ff] text-[#004ac6]";

export const fadeUp =
  "animate-[fade-up_0.35s_ease_both]";

export const glassNav =
  "bg-[#f8f9ff]/80 backdrop-blur-xl border-[#c3c6d7]/30";
