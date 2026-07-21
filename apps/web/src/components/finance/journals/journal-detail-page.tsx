"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { JournalAttachmentsPanel } from "@/components/finance/journals/journal-attachments-panel";
import { JournalAuditTimeline } from "@/components/finance/journals/journal-audit-timeline";
import {
  JournalCommentsPanel,
  type JournalCommentItem,
} from "@/components/finance/journals/journal-comments-panel";
import { JournalHeaderEditor } from "@/components/finance/journals/journal-header-editor";
import { JournalLinesEditor } from "@/components/finance/journals/journal-lines-editor";
import { JournalWorkflowActions } from "@/components/finance/journals/journal-workflow-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  getJournal,
  isJournalBalanced,
  isJournalEditable,
  journalDifference,
  type Journal,
} from "@/services/journal-service";

type Option = { id: string; label: string };

function asOptions(data: unknown, keys: string[]): Option[] {
  const list = Array.isArray(data) ? data : [];
  return list.map((row) => {
    const r = row as Record<string, unknown>;
    const label =
      keys.map((k) => r[k]).find((v) => typeof v === "string" && v) ?? String(r.id);
    return { id: String(r.id), label: String(label) };
  });
}

export function JournalDetailPage({ journalId }: { journalId: string }) {
  const { resolve } = useUserDirectory();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(
    null,
  );
  const [periods, setPeriods] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [costCenters, setCostCenters] = useState<Option[]>([]);
  const [taxes, setTaxes] = useState<Option[]>([]);
  const [auditRaw, setAuditRaw] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJournal(journalId);
      setJournal(data);

      const results = await Promise.allSettled([
        resourceService.list("/finance/periods"),
        resourceService.list("/finance/chart-of-accounts"),
        resourceService.list("/cost-centers"),
        resourceService.list("/taxes"),
        resourceService.list("/audit/logs"),
      ]);

      if (results[0].status === "fulfilled") {
        setPeriods(asOptions(results[0].value.data, ["period_name", "period_number"]));
      }
      if (results[1].status === "fulfilled") {
        const list = Array.isArray(results[1].value.data) ? results[1].value.data : [];
        setAccounts(
          list
            .filter((row) => (row as Record<string, unknown>).is_posting_account !== false)
            .map((row) => {
              const r = row as Record<string, unknown>;
              return {
                id: String(r.id),
                label: `${r.account_code} · ${r.account_name}`,
              };
            }),
        );
      }
      if (results[2].status === "fulfilled") {
        setCostCenters(asOptions(results[2].value.data, ["cost_center_name", "name", "code"]));
      }
      if (results[3].status === "fulfilled") {
        setTaxes(asOptions(results[3].value.data, ["tax_name", "tax_code", "name"]));
      }
      if (results[4].status === "fulfilled") {
        const list = Array.isArray(results[4].value.data) ? results[4].value.data : [];
        setAuditRaw(
          list.filter((row) => {
            const r = row as Record<string, unknown>;
            return String(r.entity_id ?? "") === journalId;
          }) as Record<string, unknown>[],
        );
      } else {
        setAuditRaw([]);
      }
    } catch (err) {
      setJournal(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const auditEvents = useMemo(
    () =>
      auditRaw.map((row, idx) => {
        const newValue = row.new_value as Record<string, unknown> | undefined;
        return {
          id: String(row.id ?? idx),
          operation: String(row.operation ?? ""),
          performed_by: row.performed_by ? String(row.performed_by) : null,
          created_at: row.created_at ? String(row.created_at) : null,
          detail:
            typeof newValue?.comment === "string"
              ? newValue.comment
              : undefined,
        };
      }),
    [auditRaw],
  );

  const comments: JournalCommentItem[] = useMemo(() => {
    return auditRaw
      .filter((row) => String(row.operation ?? "").toLowerCase() === "comment")
      .map((row, idx) => {
        const newValue = row.new_value as Record<string, unknown> | undefined;
        return {
          id: String(row.id ?? `c-${idx}`),
          body: String(newValue?.comment ?? ""),
          created_by: String(row.performed_by ?? ""),
          created_at: String(row.created_at ?? ""),
          source: "comment" as const,
        };
      });
  }, [auditRaw]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-32 rounded-xl bg-muted/60" />
        <div className="h-64 rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="space-y-3">
        <Link
          href="/finance/journals"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary"
        >
          <ArrowLeft className="size-3.5" /> Back to journals
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? "Journal not found"}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-3 cursor-pointer"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const diff = journalDifference(journal);
  const balanced = isJournalBalanced(journal);
  const editable = isJournalEditable(journal.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/finance/journals"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> Journals
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void load()}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <PageHeader
        title={journal.journal_number}
        description={`${journal.description} · ${editable ? "Draft editable" : "Read-only"}`}
        actions={
          <JournalWorkflowActions
            journal={journal}
            onDone={() => void load()}
            resolveUser={resolve}
          />
        }
      />

      {banner ? (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            banner.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <JournalHeaderEditor
            journal={journal}
            periods={periods}
            onSaved={(j) => setJournal(j)}
            onMessage={(text, tone) => setBanner({ text, tone })}
          />
        </div>
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium tracking-tight">Posting summary</h2>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <FinanceStatusBadge status={journal.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Workflow</dt>
              <dd>
                <FinanceStatusBadge status={journal.workflow_status} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Debit</dt>
              <dd className="font-mono">{formatInrPrecise(journal.total_debit)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Credit</dt>
              <dd className="font-mono">{formatInrPrecise(journal.total_credit)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Difference</dt>
              <dd className={`font-mono ${balanced ? "" : "text-destructive"}`}>
                {formatInrPrecise(diff)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Created by</dt>
              <dd>{resolve(journal.created_by)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Posted by</dt>
              <dd>{resolve(journal.posted_by)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Updated by</dt>
              <dd>{resolve(journal.updated_by)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <JournalLinesEditor
        journal={journal}
        accounts={accounts}
        costCenters={costCenters}
        taxes={taxes}
        onChanged={() => void load()}
        onMessage={(text, tone) => setBanner({ text, tone })}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <JournalAttachmentsPanel journalId={journal.id} readOnly={!editable} />
        <JournalCommentsPanel
          journalId={journal.id}
          items={comments}
          resolveUser={resolve}
          onPosted={() => void load()}
        />
        <JournalAuditTimeline events={auditEvents} resolveUser={resolve} />
      </div>
    </div>
  );
}
