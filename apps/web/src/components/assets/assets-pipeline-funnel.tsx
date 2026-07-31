"use client";

import Link from "next/link";

const STAGES = [
  { key: "categories", title: "Categories", href: "/assets/asset-categories" },
  { key: "assets", title: "Assets", href: "/assets/assets" },
  { key: "assignments", title: "Assignment", href: "/assets/asset-assignments" },
  { key: "maintenance", title: "Maintenance", href: "/assets/asset-maintenances" },
] as const;

interface AssetsPipelineFunnelProps {
  counts: Record<string, number>;
  loading?: boolean;
}

/** Legacy funnel — PRD dashboard uses KPI cards instead. */
export function AssetsPipelineFunnel({ counts, loading }: AssetsPipelineFunnelProps) {
  const values = STAGES.map((stage) => ({
    ...stage,
    count: counts[stage.key] ?? counts[`asset-${stage.key}`] ?? 0,
  }));

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {values.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          className="cursor-pointer rounded-lg border border-border/80 bg-card px-3 py-2 text-center text-sm transition-colors hover:bg-muted/50"
        >
          <p className="text-xs text-muted-foreground">{s.title}</p>
          <p className="font-mono text-lg font-medium">{loading ? "—" : s.count}</p>
        </Link>
      ))}
    </div>
  );
}
