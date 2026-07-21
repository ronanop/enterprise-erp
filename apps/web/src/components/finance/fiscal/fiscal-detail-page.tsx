"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FiscalFormFields, fiscalToFormValues, useFiscalForm } from "@/components/finance/fiscal/fiscal-form-fields";
import { FiscalWorkflowActions } from "@/components/finance/fiscal/fiscal-workflow-actions";
import { FiscalYearEndWizard } from "@/components/finance/fiscal/fiscal-year-end-wizard";
import { PeriodCalendarView } from "@/components/finance/fiscal/period-calendar";
import { PeriodEnterpriseTable } from "@/components/finance/fiscal/period-enterprise-table";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { JournalAuditTimeline, type AuditEvent } from "@/components/finance/journals/journal-audit-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { getPeriodJournalRestrictions } from "@/lib/finance/period-utils";
import { toFiscalPayload } from "@/lib/finance/fiscal-schema";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  bulkPeriodAction,
  getFiscalYear,
  isFiscalEditable,
  listPeriods,
  runPeriodAction,
  updateFiscalYear,
  type AccountingPeriod,
  type FiscalYear,
} from "@/services/fiscal-service";

export function FiscalDetailPage({ fiscalYearId }: { fiscalYearId: string }) {
  const { resolve } = useUserDirectory();
  const form = useFiscalForm();
  const { handleSubmit, reset, formState: { isDirty, isSubmitting, isValid } } = form;
  const [fy, setFy] = useState<FiscalYear | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [journals, setJournals] = useState<Record<string, unknown>[]>([]);
  const [auditRaw, setAuditRaw] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<Set<string>>(new Set());
  const [periodBusy, setPeriodBusy] = useState(false);

  const editable = isFiscalEditable(fy?.status);
  useUnsavedChangesWarning(editable && isDirty && !isSubmitting);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [year, periodRes, journalRes, auditRes] = await Promise.all([
        getFiscalYear(fiscalYearId),
        listPeriods({ fiscal_year_id: fiscalYearId, paged: false, page_size: 50 }),
        resourceService.list("/finance/journals", { page_size: 100 }).catch(() => ({ data: { items: [] } })),
        resourceService.list("/audit/logs").catch(() => ({ data: [] })),
      ]);
      setFy(year);
      setPeriods(periodRes.items);
      reset(fiscalToFormValues(year));
      const jData = journalRes.data;
      const jList = Array.isArray(jData)
        ? jData
        : (jData as { items?: Record<string, unknown>[] })?.items ?? [];
      setJournals(
        jList.filter((j) => String(j.fiscal_year_id ?? "") === fiscalYearId) as Record<string, unknown>[],
      );
      const auditList = Array.isArray(auditRes.data) ? auditRes.data : [];
      setAuditRaw(auditList.filter((r) => String((r as Record<string, unknown>).entity_id ?? "") === fiscalYearId) as Record<string, unknown>[]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load fiscal year");
    } finally {
      setLoading(false);
    }
  }, [fiscalYearId, reset]);

  useEffect(() => { void load(); }, [load]);

  const auditEvents: AuditEvent[] = useMemo(() => auditRaw.map((r, i) => ({
    id: String(r.id ?? i),
    operation: String(r.operation ?? "update"),
    performed_by: (r.performed_by as string) ?? null,
    created_at: (r.created_at as string) ?? null,
    detail: typeof r.new_value === "object" ? JSON.stringify(r.new_value) : String(r.new_value ?? ""),
  })), [auditRaw]);

  const periodRestrictions = useMemo(() => {
    const current = periods.find((p) => p.start_date <= new Date().toISOString().slice(0, 10) && p.end_date >= new Date().toISOString().slice(0, 10));
    return getPeriodJournalRestrictions(current);
  }, [periods]);

  const onSave = handleSubmit(async (values) => {
    if (!fy) return;
    try {
      const updated = await updateFiscalYear(fy.id, { ...toFiscalPayload(values), version: fy.version ?? undefined });
      setFy(updated);
      reset(fiscalToFormValues(updated));
      setBanner({ text: "Fiscal year saved.", tone: "success" });
    } catch (err) {
      setBanner({ text: err instanceof ApiClientError ? err.message : "Save failed", tone: "error" });
    }
  });

  const handlePeriodAction = async (action: string, ids: string[]) => {
    setPeriodBusy(true);
    try {
      if (ids.length === 1) await runPeriodAction(ids[0], action as "open" | "close" | "lock" | "unlock" | "reopen");
      else await bulkPeriodAction(ids, action as "open" | "close" | "lock" | "unlock" | "reopen");
      await load();
    } catch (err) {
      setBanner({ text: err instanceof ApiClientError ? err.message : "Period action failed", tone: "error" });
    } finally {
      setPeriodBusy(false);
    }
  };

  if (loading && !fy) return <div className="h-64 animate-pulse rounded-xl bg-muted/70" />;
  if (error && !fy) return (<div><p className="text-destructive">{error}</p><Button onClick={() => void load()}>Retry</Button></div>);
  if (!fy) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${fy.fiscal_year_code} · ${fy.fiscal_year_name}`}
        description={`${fy.start_date} → ${fy.end_date}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/fiscal-years" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"><ArrowLeft className="size-3.5" /> Back</Link>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}><RefreshCw className="size-3.5" /> Refresh</Button>
            <FinanceStatusBadge status={fy.status} />
            {fy ? <FiscalYearEndWizard fiscalYear={fy} onDone={() => void load()} /> : null}
          </div>
        }
      />
      {banner ? <p className={`rounded-lg px-3 py-2 text-sm ${banner.tone === "success" ? "bg-emerald-50 text-emerald-900" : "bg-destructive/5 text-destructive"}`}>{banner.text}</p> : null}
      {periodRestrictions.message ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{periodRestrictions.message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm"><p className="text-[11px] uppercase text-muted-foreground">Periods</p><p className="mt-2 text-xl font-medium tabular-nums">{fy.period_count ?? periods.length}</p></div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm"><p className="text-[11px] uppercase text-muted-foreground">Closed</p><p className="mt-2 text-xl font-medium tabular-nums">{fy.closed_period_count ?? 0}</p></div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm"><p className="text-[11px] uppercase text-muted-foreground">Locked</p><p className="mt-2 text-xl font-medium tabular-nums">{fy.locked_period_count ?? 0}</p></div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm"><p className="text-[11px] uppercase text-muted-foreground">Journals</p><p className="mt-2 text-xl font-medium tabular-nums">{fy.journal_count ?? journals.length}</p></div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Metadata</h3>
          <FiscalWorkflowActions fiscalYear={fy} onDone={() => void load()} />
        </div>
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          <FiscalFormFields form={form} readOnly={!editable} />
          {editable ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="cursor-pointer" disabled={!isDirty} onClick={() => reset(fiscalToFormValues(fy))}>Cancel</Button>
              <Button type="submit" className="cursor-pointer" disabled={!isDirty || !isValid || isSubmitting}>Save</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Closed/archived fiscal years are read-only.</p>}
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Accounting Periods</h3>
        <PeriodEnterpriseTable
          rows={periods}
          selectedIds={selectedPeriodIds}
          onToggleSelect={(id) => setSelectedPeriodIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          onToggleSelectAll={(ids) => setSelectedPeriodIds((prev) => ids.every((id) => prev.has(id)) ? new Set() : new Set(ids))}
          onAction={(action, ids) => void handlePeriodAction(action, ids)}
          busy={periodBusy}
        />
        <PeriodCalendarView periods={periods} onPeriodAction={(id, action) => void handlePeriodAction(action, [id])} />
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="mb-2 text-sm font-medium">Related Journals</h3>
        {journals.length === 0 ? <p className="text-xs text-muted-foreground">No journals in this fiscal year.</p> : (
          <ul className="divide-y divide-border/60">{journals.slice(0, 10).map((j) => (
            <li key={String(j.id)} className="flex justify-between py-1.5 text-sm">
              <Link href={`/finance/journals/${String(j.id)}`} className="cursor-pointer hover:underline">{String(j.journal_number ?? j.id)}</Link>
              <FinanceStatusBadge status={String(j.status ?? "")} />
            </li>
          ))}</ul>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="mb-2 text-sm font-medium">Audit Timeline</h3>
        <JournalAuditTimeline events={auditEvents} resolveUser={resolve} />
      </div>
    </div>
  );
}
