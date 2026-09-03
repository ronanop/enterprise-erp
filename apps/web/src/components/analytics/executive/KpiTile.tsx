"use client";

export function KpiTile({
  kpiKey,
  role,
}: {
  kpiKey: string;
  role: string;
}) {
  const label = kpiKey.split(".").pop()?.replaceAll("_", " ") ?? kpiKey;
  return (
    <article
      data-kpi-key={kpiKey}
      data-role={role}
      className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md"
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">—</p>
      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{kpiKey}</p>
    </article>
  );
}
