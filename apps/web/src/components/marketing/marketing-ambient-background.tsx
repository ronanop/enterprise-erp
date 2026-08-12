/** Decorative background for the marketing workspace — theme-safe, no interaction. */
export function MarketingAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-500/[0.04] blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/30 via-background to-background" />
    </div>
  );
}
