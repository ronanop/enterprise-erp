export default function ScmOvfItemPlanLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <p className="text-sm font-medium text-foreground">Opening item plan…</p>
      <div
        className="animate-pulse space-y-3 rounded-md border border-border/80 bg-muted/15 p-4"
        aria-hidden
      >
        <div className="h-5 w-56 rounded bg-muted/60" />
        <div className="h-9 w-full max-w-md rounded bg-muted/40" />
        <div className="h-48 rounded bg-muted/30" />
      </div>
    </div>
  );
}
