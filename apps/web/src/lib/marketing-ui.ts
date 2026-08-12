/** Shared marketing workspace visual tokens — uses app theme (primary, muted, border). */

export const marketingPage = "relative space-y-6";

export const marketingCard =
  "overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm dark:ring-white/[0.04]";

export const marketingCardInteractive =
  "transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-md hover:ring-primary/10";

export const marketingInsetPanel =
  "rounded-xl border border-border/60 bg-muted/20 shadow-inner";

export const marketingFeedbackBanner =
  "rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-sm";

export const marketingActionBanner =
  "rounded-2xl border border-violet-500/35 bg-gradient-to-r from-violet-500/12 via-violet-500/5 to-transparent p-4 shadow-sm";

export const marketingTableShell = "overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]";

export const marketingTableHead =
  "border-b border-border/70 bg-gradient-to-r from-muted/50 to-muted/25 text-xs uppercase tracking-wide text-muted-foreground";

export const marketingTableRow =
  "border-b border-border/40 transition-colors hover:bg-muted/25";

export const marketingDialogPanel =
  "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/98 shadow-2xl ring-1 ring-primary/10 backdrop-blur-md";

export const marketingDialogOverlay = "absolute inset-0 bg-black/55 backdrop-blur-[2px]";

export const marketingDialogHero =
  "border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-muted/40 to-background px-5 py-5";

export const marketingFieldShell =
  "rounded-xl border border-border/55 bg-background/70 p-3.5 shadow-sm transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10";

export const marketingNavActive =
  "bg-gradient-to-r from-primary/14 to-primary/5 font-medium text-primary shadow-sm ring-1 ring-primary/15";

export const marketingNavIdle =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground";
