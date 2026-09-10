import Link from "next/link";

import { qualityPipelineStages } from "@/config/quality";
import { cn } from "@/lib/utils";
import type { QualityRow } from "@/services/quality-service";

type StageCount = Record<string, number>;

interface QualityPipelineFunnelProps {
  counts: StageCount;
  loading?: boolean;
}

export function QualityPipelineFunnel({ counts, loading }: QualityPipelineFunnelProps) {
  const values = qualityPipelineStages.map((stage) => ({
    ...stage,
    count: counts[stage.resource] ?? 0,
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Quality pipeline</h2>
        <p className="text-[11px] text-muted-foreground">Incoming → CAPA (FRD-14)</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {values.map((stage, index) => {
          const prev = index > 0 ? values[index - 1].count : null;
          const conversion =
            prev != null && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
          const width = Math.max(12, Math.round((stage.count / max) * 100));
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                className="group block cursor-pointer rounded-lg border border-border/60 bg-background/60 p-2.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, "0")} · {stage.title}
                </p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums text-foreground">
                  {loading ? "—" : stage.count}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-sky-600 transition-[width] duration-300",
                      index === 1 && "bg-sky-700",
                      index === 2 && "bg-teal-600",
                      index === 3 && "bg-amber-600",
                      index === 4 && "bg-slate-600",
                    )}
                    style={{ width: `${width}%` }}
                    role="presentation"
                  />
                </div>
                {conversion != null ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {conversion}% of prior stage
                  </p>
                ) : (
                  <p className="mt-1.5 text-[10px] text-muted-foreground group-hover:text-foreground/70">
                    Open list
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const PPAP_PIPELINE = [
  { key: "draft", title: "Draft", href: "/quality/ppaps", barClass: "bg-slate-500" },
  { key: "submitted", title: "Submitted", href: "/quality/ppaps", barClass: "bg-sky-700" },
  { key: "approved", title: "Approved", href: "/quality/ppaps", barClass: "bg-teal-600" },
] as const;

interface QualityPpapPipelineProps {
  counts: { draft: number; submitted: number; approved: number };
  openCount?: number;
  loading?: boolean;
}

export function QualityPpapPipeline({ counts, openCount, loading }: QualityPpapPipelineProps) {
  const values = PPAP_PIPELINE.map((stage) => ({
    ...stage,
    count: counts[stage.key],
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">PPAP pipeline</h2>
        <p className="text-[11px] text-muted-foreground">
          Draft → submitted → approved
          {loading ? "" : ` · ${openCount ?? counts.draft + counts.submitted} open`}
        </p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {values.map((stage, index) => {
          const width = Math.max(12, Math.round((stage.count / max) * 100));
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                className="group block cursor-pointer rounded-lg border border-border/60 bg-background/60 p-2.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, "0")} · {stage.title}
                </p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums text-foreground">
                  {loading ? "—" : stage.count}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-300", stage.barClass)}
                    style={{ width: `${width}%` }}
                    role="presentation"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground group-hover:text-foreground/70">
                  Open list
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface QualitySpcOocTrendProps {
  readings: QualityRow[];
  loading?: boolean;
}

export function QualitySpcOocTrend({ readings, loading }: QualitySpcOocTrendProps) {
  const series = [...readings]
    .sort((a, b) =>
      String(a.recorded_at ?? a.created_at ?? "").localeCompare(String(b.recorded_at ?? b.created_at ?? "")),
    )
    .slice(-14);
  const oocCount = series.filter((row) => Boolean(row.is_out_of_control)).length;
  const maxH = 36;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">SPC out-of-control</h2>
        <p className="text-[11px] text-muted-foreground">
          {loading ? "—" : `${oocCount} of last ${series.length || 0} readings`}
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-muted-foreground">No SPC readings yet.</p>
      ) : (
        <div className="flex h-12 items-end gap-1" aria-label="SPC out-of-control trend">
          {series.map((row, idx) => {
            const ooc = Boolean(row.is_out_of_control);
            return (
              <div
                key={String(row.id ?? idx)}
                className={cn(
                  "min-w-0 flex-1 rounded-sm transition-colors duration-200",
                  ooc ? "bg-[#DC2626]" : "bg-sky-600/70",
                )}
                style={{ height: `${ooc ? maxH : Math.round(maxH * 0.45)}px` }}
                title={
                  ooc
                    ? `${String(row.document_number ?? "Reading")} · out of control`
                    : `${String(row.document_number ?? "Reading")} · in control`
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
