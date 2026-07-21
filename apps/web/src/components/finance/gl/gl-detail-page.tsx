"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { JournalAttachmentsPanel } from "@/components/finance/journals/journal-attachments-panel";
import {
  JournalAuditTimeline,
  type AuditEvent,
} from "@/components/finance/journals/journal-audit-timeline";
import {
  JournalCommentsPanel,
  type JournalCommentItem,
} from "@/components/finance/journals/journal-comments-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import { getGlEntry, type GlEntry } from "@/services/gl-service";
import { getJournal, type Journal } from "@/services/journal-service";

export function GlDetailPage({ entryId }: { entryId: string }) {
  const { resolve } = useUserDirectory();
  const [entry, setEntry] = useState<GlEntry | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [auditRaw, setAuditRaw] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gl = await getGlEntry(entryId);
      setEntry(gl);
      let j: Journal | null = null;
      if (gl.journal_header_id) {
        try {
          j = await getJournal(gl.journal_header_id);
          setJournal(j);
        } catch {
          setJournal(null);
        }
      }
      const entityId = gl.journal_header_id ?? entryId;
      const auditRes = await resourceService.list("/audit/logs").catch(() => ({ data: [] }));
      const list = Array.isArray(auditRes.data) ? auditRes.data : [];
      setAuditRaw(
        list.filter((row) => String((row as Record<string, unknown>).entity_id ?? "") === entityId) as Record<
          string,
          unknown
        >[],
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load ledger entry");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const auditEvents: AuditEvent[] = useMemo(
    () =>
      auditRaw.map((r, i) => ({
        id: String(r.id ?? i),
        operation: String(r.operation ?? "update"),
        performed_by: (r.performed_by as string) ?? null,
        created_at: (r.created_at as string) ?? null,
        detail:
          typeof r.new_value === "object" && r.new_value
            ? JSON.stringify(r.new_value)
            : String(r.new_value ?? r.detail ?? ""),
      })),
    [auditRaw],
  );

  const comments: JournalCommentItem[] = useMemo(
    () =>
      auditEvents
        .filter((e) => ["comment", "submit", "approve", "reject", "post", "reverse"].includes(e.operation))
        .map((e) => ({
          id: e.id,
          body: e.detail || e.operation,
          created_by: e.performed_by ?? "",
          created_at: e.created_at ?? "",
          source: e.operation === "comment" ? "comment" : "workflow",
        })),
    [auditEvents],
  );

  const readOnly = (journal?.status ?? entry?.journal_status ?? "posted").toLowerCase() === "posted"
    || (journal?.status ?? "").toLowerCase() === "reversed"
    || (journal?.status ?? "").toLowerCase() === "cancelled";

  if (loading && !entry) {
    return (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  if (error && !entry) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${entry.entry_number}`}
        description={`Posted ${entry.entry_date} · ${entry.account_code} ${entry.account_name ? `· ${entry.account_name}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/gl"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> GL
            </Link>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <FinanceStatusBadge status={entry.journal_status ?? "posted"} />
          </div>
        }
      />

      {readOnly ? (
        <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Posted ledger entries are read-only. Use the related journal for workflow history; closed periods block new posting via backend validation.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Debit</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(entry.base_debit_amount)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Credit</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(entry.base_credit_amount)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Fiscal / Period</p>
          <p className="mt-2 text-sm">{entry.fiscal_year_code ?? "—"} · {entry.period_name ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Workflow</p>
          <p className="mt-2 text-sm capitalize">{entry.workflow_status ?? journal?.workflow_status ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Voucher / Journal</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-[11px] text-muted-foreground uppercase">Voucher</dt><dd className="font-mono">{entry.entry_number}</dd></div>
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase">Journal</dt>
            <dd>
              {entry.journal_header_id ? (
                <Link href={`/finance/journals/${entry.journal_header_id}`} className="cursor-pointer font-mono hover:underline">
                  {entry.journal_number ?? entry.journal_header_id.slice(0, 8)}
                </Link>
              ) : (
                entry.journal_number ?? "—"
              )}
            </dd>
          </div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Account</dt>
            <dd>
              <Link href={`/finance/general-ledger/accounts/${entry.account_id}`} className="cursor-pointer hover:underline">
                {entry.account_code} · {entry.account_name ?? ""}
              </Link>
            </dd>
          </div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Posting</dt><dd className="font-mono text-xs">{entry.posted_at?.slice(0, 19) ?? "—"} · {resolve(entry.posted_by)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[11px] text-muted-foreground uppercase">Description</dt><dd>{entry.description ?? journal?.description ?? "—"}</dd></div>
        </dl>
      </div>

      {journal?.lines && journal.lines.length > 0 ? (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/70 px-3 py-2.5">
            <h3 className="text-sm font-medium tracking-tight">Journal Lines</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Account</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-right">Debit</th>
                  <th className="px-2 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((line) => (
                  <tr key={line.id ?? line.line_number} className={`border-b border-border/40 ${line.account_id === entry.account_id ? "bg-accent/30" : ""}`}>
                    <td className="px-2 py-1.5 font-mono text-xs">{line.line_number}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      <Link href={`/finance/general-ledger/accounts/${line.account_id}`} className="cursor-pointer hover:underline">
                        {line.account_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{line.description ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.debit_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(line.credit_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="mb-2 text-sm font-medium tracking-tight">Audit Timeline</h3>
        <JournalAuditTimeline events={auditEvents} resolveUser={resolve} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {entry.journal_header_id ? (
          <JournalCommentsPanel
            journalId={entry.journal_header_id}
            items={comments}
            resolveUser={resolve}
            onPosted={() => void load()}
            readOnly={readOnly}
          />
        ) : (
          <div className="rounded-xl border border-border/80 bg-card p-3.5 text-xs text-muted-foreground shadow-sm">
            Comments require a linked journal.
          </div>
        )}
        {entry.journal_header_id ? (
          <JournalAttachmentsPanel journalId={entry.journal_header_id} readOnly={readOnly} />
        ) : (
          <div className="rounded-xl border border-border/80 bg-card p-3.5 text-xs text-muted-foreground shadow-sm">
            Attachments API-ready when journal link exists.
          </div>
        )}
      </div>
    </div>
  );
}
