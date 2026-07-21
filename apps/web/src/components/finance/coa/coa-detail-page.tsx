"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import {
  CoaAccountFormFields,
  accountToFormValues,
  useCoaForm,
} from "@/components/finance/coa/coa-account-form-fields";
import { CoaAttachmentsPanel } from "@/components/finance/coa/coa-attachments-panel";
import { CoaCommentsPanel, type CoaCommentItem } from "@/components/finance/coa/coa-comments-panel";
import { CoaMergeWizard } from "@/components/finance/coa/coa-merge-wizard";
import { CoaWorkflowActions } from "@/components/finance/coa/coa-workflow-actions";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  JournalAuditTimeline,
  type AuditEvent,
} from "@/components/finance/journals/journal-audit-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { toCoaPayload } from "@/lib/finance/coa-schema";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  accountTypeLabel,
  getAccount,
  getAccountBalance,
  isCoaEditable,
  listAccountGroups,
  listAccounts,
  listChildAccounts,
  listRelatedJournals,
  updateAccount,
  type AccountGroup,
  type ChartOfAccount,
  type CoaBalance,
  type CoaRelatedJournal,
} from "@/services/coa-service";

export function CoaDetailPage({ accountId }: { accountId: string }) {
  const { resolve } = useUserDirectory();
  const form = useCoaForm();
  const {
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting, isValid },
  } = form;

  const [account, setAccount] = useState<ChartOfAccount | null>(null);
  const [balance, setBalance] = useState<CoaBalance | null>(null);
  const [children, setChildren] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<CoaRelatedJournal[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [parents, setParents] = useState<{ id: string; label: string }[]>([]);
  const [allAccounts, setAllAccounts] = useState<ChartOfAccount[]>([]);
  const [auditRaw, setAuditRaw] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const editable = isCoaEditable(account?.status);
  useUnsavedChangesWarning(editable && isDirty && !isSubmitting);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acct, bal, kids, jrn, g, tree, auditRes] = await Promise.all([
        getAccount(accountId),
        getAccountBalance(accountId),
        listChildAccounts(accountId),
        listRelatedJournals(accountId),
        listAccountGroups(),
        listAccounts({ tree: true, paged: true, page_size: 500 }),
        resourceService.list("/audit/logs").catch(() => ({ data: [] })),
      ]);
      setAccount(acct);
      setBalance(bal);
      setChildren(kids);
      setJournals(jrn);
      setGroups(g);
      setAllAccounts(tree.items);
      setParents(
        tree.items
          .filter((a) => a.id !== accountId)
          .map((a) => ({ id: a.id, label: `${a.account_code} · ${a.account_name}` })),
      );
      reset(accountToFormValues(acct));
      const list = Array.isArray(auditRes.data) ? auditRes.data : [];
      setAuditRaw(
        list.filter((row) => {
          const r = row as Record<string, unknown>;
          return String(r.entity_id ?? "") === accountId;
        }) as Record<string, unknown>[],
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [accountId, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const hierarchy = useMemo(() => {
    if (!account) return [];
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const chain: ChartOfAccount[] = [];
    let cur: ChartOfAccount | undefined = account;
    const guard = new Set<string>();
    while (cur) {
      chain.unshift(cur);
      if (!cur.parent_account_id || guard.has(cur.parent_account_id)) break;
      guard.add(cur.id);
      cur = byId.get(cur.parent_account_id);
    }
    return chain;
  }, [account, allAccounts]);

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

  const commentItems: CoaCommentItem[] = useMemo(
    () =>
      auditEvents
        .filter((e) => e.operation === "comment" || e.operation === "reject" || e.operation === "submit")
        .map((e) => ({
          id: e.id,
          body: e.detail || e.operation,
          created_by: e.performed_by ?? "",
          created_at: e.created_at ?? "",
          source: e.operation === "comment" ? "comment" : "workflow",
        })),
    [auditEvents],
  );

  const onSave = handleSubmit(async (values) => {
    if (!account) return;
    setBanner(null);
    try {
      const updated = await updateAccount(account.id, {
        ...toCoaPayload(values),
        version: account.version,
      });
      setAccount(updated);
      reset(accountToFormValues(updated));
      setBanner({ text: "Account saved.", tone: "success" });
      void load();
    } catch (err) {
      setBanner({
        text: err instanceof ApiClientError ? err.message : "Save failed",
        tone: "error",
      });
    }
  });

  if (loading && !account) {
    return (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  if (error && !account) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${account.account_code} · ${account.account_name}`}
        description={`${accountTypeLabel(account.account_type)} · ${account.account_group_name ?? "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/chart-of-accounts"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> Back
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5"
              onClick={() => void load()}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <FinanceStatusBadge status={account.status} />
          </div>
        }
      />

      {banner ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            banner.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Current Balance
          </p>
          <p className="mt-2 font-mono text-xl tabular-nums">
            {formatInrPrecise(balance?.balance ?? account.balance ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Dr {formatInrPrecise(balance?.debit_total ?? 0)} · Cr{" "}
            {formatInrPrecise(balance?.credit_total ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Allow Posting
          </p>
          <p className="mt-2 text-sm font-medium">{account.is_posting_account ? "Yes" : "No"}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm sm:col-span-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Parent Hierarchy
          </p>
          <p className="mt-2 text-sm">
            {hierarchy.map((h, i) => (
              <span key={h.id}>
                {i > 0 ? <span className="mx-1 text-muted-foreground">/</span> : null}
                <Link
                  href={`/finance/chart-of-accounts/${h.id}`}
                  className="cursor-pointer hover:underline"
                >
                  {h.account_code}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium tracking-tight">Account Details</h3>
          <CoaWorkflowActions account={account} onDone={() => void load()} />
        </div>
        <form
          onSubmit={(e) => void onSave(e)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
              e.preventDefault();
              void onSave();
            }
          }}
          className="space-y-4"
        >
          <CoaAccountFormFields
            form={form}
            groups={groups}
            parentOptions={parents}
            readOnly={!editable}
          />
          {!editable ? (
            <p className="text-xs text-muted-foreground">
              Active accounts are read-only. Deactivate to edit metadata.
            </p>
          ) : null}
          {editable ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={!isDirty || isSubmitting}
                onClick={() => {
                  if (isDirty && !window.confirm("Discard unsaved changes?")) return;
                  reset(accountToFormValues(account));
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={!isDirty || !isValid || isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <h3 className="text-sm font-medium tracking-tight">Child Accounts</h3>
          {children.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No child accounts.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {children.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-1.5 text-sm">
                  <Link
                    href={`/finance/chart-of-accounts/${c.id}`}
                    className="cursor-pointer hover:underline"
                  >
                    {c.account_code} · {c.account_name}
                  </Link>
                  <FinanceStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <h3 className="text-sm font-medium tracking-tight">Related Journals</h3>
          {journals.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No journals reference this account.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {journals.map((j) => (
                <li key={j.id} className="flex justify-between gap-2 py-1.5 text-sm">
                  <Link href={`/finance/journals/${j.id}`} className="cursor-pointer hover:underline">
                    {j.journal_number}
                  </Link>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatInrPrecise(j.total_debit)} / {formatInrPrecise(j.total_credit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="mb-2 text-sm font-medium tracking-tight">Audit Timeline / Change History</h3>
        <JournalAuditTimeline events={auditEvents} resolveUser={resolve} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CoaCommentsPanel items={commentItems} resolveUser={resolve} readOnly={!editable} />
        <CoaAttachmentsPanel accountId={account.id} readOnly={!editable} />
      </div>

      <CoaMergeWizard accounts={allAccounts} currentId={account.id} />
    </div>
  );
}
