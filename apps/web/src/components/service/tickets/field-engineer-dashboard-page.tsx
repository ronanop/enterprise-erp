"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Paperclip,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  listMyFieldEngineerTickets,
  markFieldEngineerSolved,
  type FieldEngineerTicketItem,
} from "@/services/service-request-ticket-service";

type FeTab = "live" | "done";

function BriefRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/80 px-3 py-2.5">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm leading-snug whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function FeDashboardSubNav({
  active,
  liveCount,
  doneCount,
  onChange,
}: {
  active: FeTab;
  liveCount: number;
  doneCount: number;
  onChange: (tab: FeTab) => void;
}) {
  const tabs: { id: FeTab; label: string; count: number }[] = [
    { id: "live", label: "Live tickets", count: liveCount },
    { id: "done", label: "Done tickets", count: doneCount },
  ];

  return (
    <nav aria-label="Field engineer tickets" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-t-md px-3 text-xs font-medium transition-colors duration-200",
                  isActive
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TicketDetailsPanel({ row }: { row: FieldEngineerTicketItem }) {
  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      {row.work_brief ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <div className="text-[11px] font-semibold tracking-wide uppercase">Work brief</div>
          <p className="mt-1 whitespace-pre-wrap">{row.work_brief}</p>
        </div>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-2">
        <BriefRow label="Issue" value={row.issue_description} />
        <BriefRow label="End customer" value={row.end_customer_name} />
        <BriefRow label="LC / Coordinator" value={row.coordinator_name} />
        <BriefRow label="LC phone" value={row.coordinator_phone} />
        <BriefRow label="Address" value={row.end_customer_street} />
        <BriefRow
          label="City / State / PIN"
          value={[row.end_customer_city, row.end_customer_state, row.end_customer_postal_code]
            .filter(Boolean)
            .join(", ")}
        />
        <BriefRow label="Site availability" value={row.site_availability} />
        <BriefRow label="Site instructions" value={row.site_instructions} />
        <BriefRow label="Asset" value={row.asset_name} />
        <BriefRow
          label="Device"
          value={
            row.asset_status === "new_asset"
              ? "New device"
              : row.asset_status === "existing_asset"
                ? "Existing device"
                : row.asset_status
          }
        />
        <BriefRow label="Serial" value={row.serial_number} />
        <BriefRow label="SR No" value={row.reference_sr_number} />
        <BriefRow label="CKT ID" value={row.ckt_id} />
        <BriefRow label="Link type" value={row.link_type} />
        <BriefRow label="Bandwidth" value={row.bandwidth} />
        <BriefRow label="Ports in use" value={row.ports_in_use} />
        <BriefRow label="IP / credentials notes" value={row.ip_details} />
        <BriefRow label="Previous FE notes" value={row.previous_fe_notes} />
      </dl>
    </div>
  );
}

function TicketMeta({ row }: { row: FieldEngineerTicketItem }) {
  const location = [row.end_customer_city, row.end_customer_state].filter(Boolean).join(", ");
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {row.assigned_date ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5">
          <Calendar className="size-3" />
          Assigned {row.assigned_date.slice(0, 10)}
        </span>
      ) : null}
      {location ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5">
          <MapPin className="size-3" />
          {location}
        </span>
      ) : null}
    </div>
  );
}

function LiveTicketCard({
  row,
  open,
  onToggle,
  solution,
  onSolutionChange,
  files,
  onAddFiles,
  onRemoveFile,
  saving,
  onSubmit,
}: {
  row: FieldEngineerTicketItem;
  open: boolean;
  onToggle: () => void;
  solution: string;
  onSolutionChange: (value: string) => void;
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <article className="rounded-lg border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{row.document_number}</span>
            <FinanceStatusBadge status={row.status} />
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
              Live
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">{row.subject}</p>
          <TicketMeta row={row} />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onToggle}>
          {open ? (
            <>
              <ChevronUp className="size-3.5" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              View details
            </>
          )}
        </Button>
      </div>

      {open ? <TicketDetailsPanel row={row} /> : null}

      <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">What did you do on site?</label>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Describe the work completed, parts replaced, tests done, etc."
            value={solution}
            onChange={(e) => onSolutionChange(e.target.value)}
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted/40">
          <Paperclip className="size-4" />
          Attach photos / reports (optional)
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              onAddFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <Paperclip className="size-3 shrink-0" />
                <span className="min-w-0 truncate">{f.name}</span>
                <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => onRemoveFile(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={saving || !solution.trim()} onClick={onSubmit}>
            <Wrench className="size-3.5" />
            {saving ? "Submitting…" : "Submit work & mark done"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            After submit, this ticket moves to the Done section for your records.
          </p>
        </div>
      </div>
    </article>
  );
}

function DoneTicketCard({
  row,
  open,
  onToggle,
}: {
  row: FieldEngineerTicketItem;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{row.document_number}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
              <CheckCircle2 className="size-3" />
              Done
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug">{row.subject}</p>
          <TicketMeta row={row} />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onToggle}>
          {open ? "Hide" : "View"}
        </Button>
      </div>
      <div className="mt-3 rounded-md border border-emerald-600/20 bg-white/80 px-3 py-2.5">
        <div className="text-[11px] font-medium tracking-wide text-emerald-900 uppercase">Your submission</div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {row.solution_summary || "Work submitted."}
        </p>
      </div>
      {open ? <TicketDetailsPanel row={row} /> : null}
    </article>
  );
}

export function FieldEngineerDashboardPage() {
  const [rows, setRows] = useState<FieldEngineerTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeTab>("live");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyFieldEngineerTickets();
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load your tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { liveTickets, doneTickets } = useMemo(() => {
    const live: FieldEngineerTicketItem[] = [];
    const done: FieldEngineerTicketItem[] = [];
    for (const row of rows) {
      if (row.field_engineer_status === "solved") {
        done.push(row);
      } else {
        live.push(row);
      }
    }
    return { liveTickets: live, doneTickets: done };
  }, [rows]);

  const onSolve = async (row: FieldEngineerTicketItem) => {
    const text = (solutions[row.field_engineer_id] || "").trim();
    if (!text) return;
    setSavingId(row.field_engineer_id);
    setError(null);
    try {
      await markFieldEngineerSolved(row.id, row.field_engineer_id, text, files[row.field_engineer_id] || []);
      setSolutions((s) => {
        const next = { ...s };
        delete next[row.field_engineer_id];
        return next;
      });
      setFiles((f) => {
        const next = { ...f };
        delete next[row.field_engineer_id];
        return next;
      });
      setExpandedId(null);
      setActiveTab("done");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to submit work");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My site visits"
        description="Assigned tickets appear under Live. After you submit your work, they move to Done."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <FeDashboardSubNav
        active={activeTab}
        liveCount={liveTickets.length}
        doneCount={doneTickets.length}
        onChange={(tab) => {
          setActiveTab(tab);
          setExpandedId(null);
        }}
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading your tickets…</p>
        ) : activeTab === "live" ? (
          liveTickets.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium">No live tickets</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length === 0
                  ? "When a service engineer assigns you, the ticket appears here."
                  : "All assigned tickets are completed. Check Done tickets."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {liveTickets.map((row) => (
                <LiveTicketCard
                  key={row.field_engineer_id}
                  row={row}
                  open={expandedId === row.field_engineer_id}
                  onToggle={() =>
                    setExpandedId((id) => (id === row.field_engineer_id ? null : row.field_engineer_id))
                  }
                  solution={solutions[row.field_engineer_id] ?? ""}
                  onSolutionChange={(value) =>
                    setSolutions((s) => ({ ...s, [row.field_engineer_id]: value }))
                  }
                  files={files[row.field_engineer_id] || []}
                  onAddFiles={(list) =>
                    setFiles((f) => ({
                      ...f,
                      [row.field_engineer_id]: [...(f[row.field_engineer_id] || []), ...list],
                    }))
                  }
                  onRemoveFile={(index) =>
                    setFiles((prev) => ({
                      ...prev,
                      [row.field_engineer_id]: (prev[row.field_engineer_id] || []).filter((_, i) => i !== index),
                    }))
                  }
                  saving={savingId === row.field_engineer_id}
                  onSubmit={() => void onSolve(row)}
                />
              ))}
            </div>
          )
        ) : doneTickets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">No done tickets yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit your work on a live ticket and it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {doneTickets.map((row) => (
              <DoneTicketCard
                key={row.field_engineer_id}
                row={row}
                open={expandedId === row.field_engineer_id}
                onToggle={() =>
                  setExpandedId((id) => (id === row.field_engineer_id ? null : row.field_engineer_id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
