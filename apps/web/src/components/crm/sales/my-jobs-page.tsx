"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Check, RefreshCw, X } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  decideMyJob,
  listMyJobs,
  listOpportunities,
  listOvfs,
  listQuotes,
  listSalesLeads,
  myJobEntityHref,
  type ApprovalTask,
} from "@/services/sales-crm-service";

const TEAM_ROLES = ["presales", "project", "management", "accounts", "scm"];
const STATUSES = ["pending", "approved", "rejected", "cancelled"];

type SortKey = "title" | "entity_type" | "team_role" | "priority" | "status" | "due_at";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function MyJobsPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [mineOnly, setMineOnly] = useState(false);
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("due_at", "asc");

  const [decision, setDecision] = useState<{ task: ApprovalTask; outcome: "approved" | "rejected" } | null>(null);
  const [remark, setRemark] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await listMyJobs({
        team_role: teamRole || undefined,
        status: status || undefined,
        mine: mineOnly || undefined,
      });

      if (!companyAccountId) {
        setRows(tasks);
        return;
      }

      const [leads, opps, quotes, ovfs] = await Promise.all([
        listSalesLeads(companyAccountId).catch(() => []),
        listOpportunities({ company_account_id: companyAccountId }).catch(() => []),
        listQuotes({ company_account_id: companyAccountId }).catch(() => []),
        listOvfs({ company_account_id: companyAccountId }).catch(() => []),
      ]);

      const entityIds = new Set<string>([
        companyAccountId,
        ...leads.map((row) => row.id),
        ...opps.map((row) => row.id),
        ...quotes.map((row) => row.id),
        ...ovfs.map((row) => row.id),
      ]);

      setRows(tasks.filter((task) => entityIds.has(task.entity_id)));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [teamRole, status, mineOnly, companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openDecision(task: ApprovalTask, outcome: "approved" | "rejected") {
    setDecision({ task, outcome });
    setRemark("");
    setDecideError(null);
  }

  async function submitDecision() {
    if (!decision) return;
    if (decision.outcome === "rejected" && !remark.trim()) {
      setDecideError("A remark is required to reject a task.");
      return;
    }
    setDeciding(true);
    setDecideError(null);
    try {
      await decideMyJob(decision.task.id, decision.outcome, remark.trim() || undefined);
      setDecision(null);
      await load();
    } catch (err) {
      setDecideError(err instanceof ApiClientError ? err.message : "Failed to record decision");
    } finally {
      setDeciding(false);
    }
  }

  const sorted = useMemo(
    () =>
      sortRows(rows, sortBy, sortDir, {
        title: (t) => t.title,
        entity_type: (t) => t.entity_type,
        team_role: (t) => t.team_role,
        priority: (t) => t.priority,
        status: (t) => t.status,
        due_at: (t) => t.due_at,
      }),
    [rows, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="My Jobs"
          description="Team approval inbox — approve or reject requests routed from the sales blueprint, with remarks."
          actions={
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Team</span>
          <FinanceSelect value={teamRole} onChange={(e) => setTeamRole(e.target.value)} className="w-36">
            <option value="">All teams</option>
            {TEAM_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </FinanceSelect>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</span>
          <FinanceSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FinanceSelect>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="cursor-pointer"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          Assigned to me only
        </label>
        {embedded ? (
          <Button type="button" variant="outline" size="sm" className="ml-auto cursor-pointer" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        ) : null}
      </div>

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Tasks"
          subtitle="Approval inbox"
          icon={Briefcase}
          count={sorted.length}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Task" sortKey="title" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Entity" sortKey="entity_type" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Team" sortKey="team_role" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Priority" sortKey="priority" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Due" sortKey="due_at" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading tasks…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No tasks match these filters.
                  </td>
                </tr>
              ) : (
                sorted.map((task) => (
                  <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{task.title}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{task.task_code}</div>
                      {task.remarks ? <div className="mt-0.5 text-[11px] text-muted-foreground">“{task.remarks}”</div> : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={myJobEntityHref(task.entity_type, task.entity_id)}
                        className="cursor-pointer capitalize text-primary hover:underline"
                      >
                        {task.entity_type}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{task.team_role}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(task.due_at)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {task.status === "pending" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => openDecision(task, "approved")}
                          >
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => openDecision(task, "rejected")}
                          >
                            <X className="size-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {task.decided_at ? `Decided ${formatDate(task.decided_at)}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>

      <ConfirmDialog
        open={Boolean(decision)}
        title={decision?.outcome === "approved" ? "Approve task" : "Reject task"}
        description={decision ? `${decision.task.title} (${decision.task.task_code})` : undefined}
        tone={decision?.outcome === "rejected" ? "destructive" : "default"}
        confirmLabel={decision?.outcome === "approved" ? "Approve" : "Reject"}
        busy={deciding}
        onCancel={() => !deciding && setDecision(null)}
        onConfirm={() => void submitDecision()}
      >
        <div className="mt-3 space-y-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Remark{decision?.outcome === "rejected" ? " *" : ""}
          </span>
          <FinanceTextarea value={remark} onChange={(e) => setRemark(e.target.value)} />
          {decideError ? <p className="text-xs text-destructive">{decideError}</p> : null}
        </div>
      </ConfirmDialog>
    </CrmPage>
  );
}
