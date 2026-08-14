"use client";

import { useMemo } from "react";
import { BarChart3, Package, PackageCheck, Receipt, Warehouse } from "lucide-react";

import {
  Exploded3dPieChart,
  type Exploded3dPieSlice,
} from "@/components/procurement/exploded-3d-pie";
import { cn } from "@/lib/utils";
import {
  buildPoFulfillmentMetrics,
  formatPoQty,
  type PoFulfillmentBatchInput,
  type PoFulfillmentLineInput,
} from "@/utils/po-fulfillment-metrics";

const COLOR = {
  received: "#0369A1",
  remaining: "#F59E0B",
  billed: "#059669",
  unbilled: "#0D9488",
  ordered: "#0F172A",
} as const;

type PoFulfillmentChartsProps = {
  /** Company PO / document number — scopes the panel to the open order only. */
  poLabel: string;
  lines: PoFulfillmentLineInput[];
  batches?: PoFulfillmentBatchInput[];
  loading?: boolean;
  className?: string;
};

function StatChip({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Package;
  tone: "sky" | "amber" | "emerald" | "teal" | "slate";
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200/80 bg-gradient-to-br from-sky-50 via-sky-50/70 to-white text-sky-950"
      : tone === "amber"
        ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-amber-50/70 to-white text-amber-950"
        : tone === "emerald"
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-white text-emerald-950"
          : tone === "teal"
            ? "border-teal-200/80 bg-gradient-to-br from-teal-50 via-teal-50/70 to-white text-teal-950"
            : "border-slate-200/80 bg-gradient-to-br from-slate-50 via-slate-50/70 to-white text-slate-950";
  const iconClass =
    tone === "sky"
      ? "bg-sky-100 text-sky-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : tone === "emerald"
          ? "bg-emerald-100 text-emerald-800"
          : tone === "teal"
            ? "bg-teal-100 text-teal-800"
            : "bg-slate-200/80 text-slate-800";

  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] items-start gap-2.5 rounded-xl border px-3 py-3 shadow-sm",
        "transition-[box-shadow] duration-200",
        toneClass,
      )}
    >
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          iconClass,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  slices,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  slices: Exploded3dPieSlice[];
  emptyLabel: string;
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <div className="rounded-xl border border-sky-200/60 bg-gradient-to-b from-white via-sky-50/30 to-white px-3 py-3 shadow-sm">
      <div className="mb-2 px-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-900/80">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {total <= 0 ? (
        <p className="px-1 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <Exploded3dPieChart
            slices={slices}
            ariaLabel={title}
            size={140}
            layout="compact"
            legendMode="count"
          />
          <ul className="mt-2 space-y-1.5 px-1" aria-label={`${title} breakdown`}>
            {slices.map((slice) => {
              const pct = total > 0 ? Math.round((slice.value / total) * 1000) / 10 : 0;
              return (
                <li
                  key={slice.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden
                    />
                    <span className="truncate text-foreground">{slice.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatPoQty(slice.value)} · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function MiniTrack({
  received,
  remaining,
  billed,
  unbilled,
}: {
  received: number;
  remaining: number;
  billed: number;
  unbilled: number;
}) {
  const ordered = received + remaining;
  if (ordered <= 0) return null;
  return (
    <div className="space-y-1">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted/60"
        role="img"
        aria-label={`Received ${formatPoQty(received)}, pending ${formatPoQty(remaining)}`}
      >
        {received > 0 ? (
          <div
            className="h-full"
            style={{ width: `${(received / ordered) * 100}%`, backgroundColor: COLOR.received }}
          />
        ) : null}
        {remaining > 0 ? (
          <div
            className="h-full"
            style={{ width: `${(remaining / ordered) * 100}%`, backgroundColor: COLOR.remaining }}
          />
        ) : null}
      </div>
      {received > 0 ? (
        <div
          className="flex h-2 overflow-hidden rounded-full bg-muted/60"
          role="img"
          aria-label={`Billed ${formatPoQty(billed)}, stock ${formatPoQty(unbilled)}`}
        >
          {billed > 0 ? (
            <div
              className="h-full"
              style={{ width: `${(billed / received) * 100}%`, backgroundColor: COLOR.billed }}
            />
          ) : null}
          {unbilled > 0 ? (
            <div
              className="h-full"
              style={{ width: `${(unbilled / received) * 100}%`, backgroundColor: COLOR.unbilled }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PoFulfillmentCharts({
  poLabel,
  lines,
  batches = [],
  loading,
  className,
}: PoFulfillmentChartsProps) {
  const metrics = useMemo(
    () => buildPoFulfillmentMetrics(lines, batches),
    [lines, batches],
  );

  const receiptSlices = useMemo((): Exploded3dPieSlice[] => {
    const slices: Exploded3dPieSlice[] = [];
    if (metrics.receivedQty > 0) {
      slices.push({
        key: "received",
        label: "Received (GRN)",
        value: metrics.receivedQty,
        color: COLOR.received,
      });
    }
    if (metrics.remainingQty > 0) {
      slices.push({
        key: "remaining",
        label: "Pending GRN",
        value: metrics.remainingQty,
        color: COLOR.remaining,
      });
    }
    if (slices.length === 0 && metrics.orderedQty > 0) {
      slices.push({
        key: "ordered",
        label: "Ordered",
        value: metrics.orderedQty,
        color: COLOR.ordered,
      });
    }
    return slices;
  }, [metrics]);

  const billingSlices = useMemo((): Exploded3dPieSlice[] => {
    const slices: Exploded3dPieSlice[] = [];
    if (metrics.billedQty > 0) {
      slices.push({
        key: "billed",
        label: "Billed",
        value: metrics.billedQty,
        color: COLOR.billed,
      });
    }
    if (metrics.unbilledQty > 0) {
      slices.push({
        key: "unbilled",
        label: "In stock (not billed)",
        value: metrics.unbilledQty,
        color: COLOR.unbilled,
      });
    }
    return slices;
  }, [metrics]);

  if (loading) {
    return (
      <section
        className={cn(
          "space-y-3 rounded-lg border-2 border-foreground/20 bg-card p-4 shadow-sm",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Loading fulfillment for this PO…</p>
      </section>
    );
  }

  if (metrics.lineCount === 0 && metrics.orderedQty <= 0) {
    return null;
  }

  const titlePo = poLabel.trim() || "This purchase order";

  return (
    <section
      className={cn(
        "space-y-4 rounded-lg border-2 border-sky-200/50 bg-gradient-to-br from-sky-50/50 via-card to-teal-50/30 p-4 shadow-sm",
        className,
      )}
      aria-label={`Fulfillment for ${titlePo}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-100 text-sky-800">
            <BarChart3 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Fulfillment for {titlePo}
            </h2>
            <p className="text-xs text-muted-foreground">
              Only this purchase order · {metrics.lineCount} line
              {metrics.lineCount === 1 ? "" : "s"} · {metrics.grnCount} GRN
              {metrics.grnCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <StatChip
          label="Ordered"
          value={formatPoQty(metrics.orderedQty)}
          hint={`${metrics.lineCount} products on this PO`}
          icon={Package}
          tone="slate"
        />
        <StatChip
          label="Received"
          value={formatPoQty(metrics.receivedQty)}
          hint={`${metrics.receivePct}% of this PO`}
          icon={PackageCheck}
          tone="sky"
        />
        <StatChip
          label="Pending GRN"
          value={formatPoQty(metrics.remainingQty)}
          hint="Still to receive on this PO"
          icon={Package}
          tone="amber"
        />
        <StatChip
          label="Billed"
          value={formatPoQty(metrics.billedQty)}
          hint={
            metrics.receivedQty > 0
              ? `${metrics.billPctOfReceived}% of received on this PO`
              : "No GRN on this PO yet"
          }
          icon={Receipt}
          tone="emerald"
        />
        <StatChip
          label="In stock"
          value={formatPoQty(metrics.unbilledQty)}
          hint="This PO — received, not billed"
          icon={Warehouse}
          tone="teal"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Receipt progress"
          subtitle={`Ordered qty on ${titlePo}`}
          slices={receiptSlices}
          emptyLabel="No ordered quantity on this PO."
        />
        <ChartCard
          title="Billing mix"
          subtitle={`Received qty on ${titlePo}`}
          slices={billingSlices}
          emptyLabel="No GRN on this PO yet — bill split appears after receipt."
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-white/80">
        <div className="border-b border-border/70 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Line items on {titlePo}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-border/70 bg-muted/30 text-[10px] font-bold uppercase tracking-wide text-foreground">
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Ordered</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Pending</th>
                <th className="px-3 py-2.5 text-right">Billed</th>
                <th className="px-3 py-2.5 text-right">Stock</th>
                <th className="px-3 py-2.5 min-w-[140px]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {metrics.lines.map((row) => (
                <tr key={row.lineId} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.productLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPoQty(row.orderedQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sky-800">
                    {formatPoQty(row.receivedQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-800">
                    {formatPoQty(row.remainingQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-800">
                    {formatPoQty(row.billedQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-teal-800">
                    {formatPoQty(row.unbilledQty)}
                  </td>
                  <td className="px-3 py-2.5">
                    <MiniTrack
                      received={row.receivedQty}
                      remaining={row.remainingQty}
                      billed={row.billedQty}
                      unbilled={row.unbilledQty}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
