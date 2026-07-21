"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  FilePen,
  RotateCcw,
  Send,
  ShieldCheck,
  ShieldX,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type AuditEvent = {
  id: string;
  operation: string;
  performed_by?: string | null;
  created_at?: string | null;
  detail?: string;
};

const OP_META: Record<
  string,
  { label: string; icon: typeof Send; tone: string }
> = {
  create: { label: "Created", icon: FilePen, tone: "bg-sky-50 text-sky-900 border-sky-200" },
  update: { label: "Updated", icon: FilePen, tone: "bg-slate-50 text-slate-900 border-slate-200" },
  submit: { label: "Submitted", icon: Send, tone: "bg-amber-50 text-amber-950 border-amber-200" },
  approve: {
    label: "Approved",
    icon: ShieldCheck,
    tone: "bg-emerald-50 text-emerald-950 border-emerald-200",
  },
  reject: {
    label: "Rejected",
    icon: ShieldX,
    tone: "bg-rose-50 text-rose-950 border-rose-200",
  },
  post: {
    label: "Posted",
    icon: CheckCircle2,
    tone: "bg-emerald-50 text-emerald-950 border-emerald-200",
  },
  reverse: {
    label: "Reversed",
    icon: RotateCcw,
    tone: "bg-orange-50 text-orange-950 border-orange-200",
  },
  comment: {
    label: "Comment",
    icon: Upload,
    tone: "bg-muted/40 text-foreground border-border/70",
  },
  reorder_lines: {
    label: "Lines reordered",
    icon: FilePen,
    tone: "bg-muted/40 text-foreground border-border/70",
  },
  delete: {
    label: "Line deleted",
    icon: ShieldX,
    tone: "bg-muted/40 text-foreground border-border/70",
  },
};

type Props = {
  events: AuditEvent[];
  resolveUser: (id?: string | null) => string;
};

export function JournalAuditTimeline({ events, resolveUser }: Props) {
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      ),
    [events],
  );

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-medium tracking-tight">Audit timeline</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Created · Updated · Submitted · Approved · Rejected · Posted · Reversed
      </p>
      <ol className="relative mt-4 space-y-3 border-l border-border/70 pl-4">
        {sorted.length === 0 ? (
          <li className="text-xs text-muted-foreground">No audit events for this journal.</li>
        ) : (
          sorted.map((event) => {
            const op = (event.operation || "").toLowerCase();
            const meta = OP_META[op] ?? {
              label: event.operation || "Event",
              icon: FilePen,
              tone: "bg-muted/40 text-foreground border-border/70",
            };
            const Icon = meta.icon;
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
                <div className={cn("rounded-lg border px-3 py-2 text-xs", meta.tone)}>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-3.5" />
                    {meta.label}
                  </div>
                  <p className="mt-1">{resolveUser(event.performed_by)}</p>
                  <p className="mt-0.5 text-[10px] opacity-80">
                    {event.created_at
                      ? new Date(event.created_at).toLocaleString("en-IN")
                      : "—"}
                  </p>
                  {event.detail ? (
                    <p className="mt-1 text-[11px] opacity-90">{event.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}
