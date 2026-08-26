"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Check, X } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  decideMyJob,
  getOpportunity,
  getOvf,
  getQuote,
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

type SortKey = "title" | "opportunity_name" | "team_role" | "status";

function myJobDetailHref(task: ApprovalTask): string {
  const base = myJobEntityHref(task.entity_type, task.entity_id);
  if (base === "/crm/my-jobs") return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}from=my-jobs`;
}

export function MyJobsPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<ApprovalTask[]>([]);
  const [recordNames, setRecordNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [mineOnly, setMineOnly] = useState(true);
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("title", "asc");

  const [decision, setDecision] = useState<{ task: ApprovalTask; outcome: "approved" | "rejected" } | null>(null);
  const [remark, setRemark] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);

  const loadNames = useCallback(async (tasks: ApprovalTask[]) => {
    const names: Record<string, string> = {};
    const oppCache = new Map<string, string>();

    async function opportunityName(id: string): Promise<string | null> {
      if (oppCache.has(id)) return oppCache.get(id) ?? null;
      try {
        const opp = await getOpportunity(id);
        oppCache.set(id, opp.opportunity_name);
        return opp.opportunity_name;
      } catch {
        return null;
      }
    }

    await Promise.all(
      tasks.map(async (task) => {
        try {
          if (task.entity_type === "opportunity") {
            names[task.id] = (await opportunityName(task.entity_id)) ?? "—";
          } else if (task.entity_type === "quote") {
            const quote = await getQuote(task.entity_id);
            names[task.id] =
              (quote.opportunity_id ? await opportunityName(quote.opportunity_id) : null) ?? quote.quote_no;
          } else if (task.entity_type === "ovf") {
            const ovf = await getOvf(task.entity_id);
            names[task.id] =
              (ovf.opportunity_id ? await opportunityName(ovf.opportunity_id) : null) ?? ovf.ovf_no;
          } else {
            names[task.id] = "—";
          }
        } catch {
          names[task.id] = "—";
        }
      }),
    );
    setRecordNames(names);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await listMyJobs({
        team_role: teamRole || undefined,
        status: status || undefined,
        mine: mineOnly || undefined,
      });

      let visible = tasks;
      if (companyAccountId) {
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

        visible = tasks.filter((task) => entityIds.has(task.entity_id));
      }

      setRows(visible);
      await loadNames(visible);
    } catch (err) {
      setRows([]);
      setRecordNames({});
      setError(err instanceof ApiClientError ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [teamRole, status, mineOnly, companyAccountId, loadNames]);

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
        opportunity_name: (t) => recordNames[t.id] ?? "",
        team_role: (t) => t.team_role,
        status: (t) => t.status,
      }),
    [rows, sortBy, sortDir, recordNames],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="My Jobs"
          description="Team approval inbox — approve or reject requests routed from the sales blueprint, with remarks."
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
          Assigned to me / sent by me
        </label>
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <CrmSortableTh label="Task" sortKey="title" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh
                  label="Opportunity name"
                  sortKey="opportunity_name"
                  activeKey={sortBy}
                  dir={sortDir}
                  onSort={onSort}
                />
                <CrmSortableTh label="Team" sortKey="team_role" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading tasks…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {mineOnly
                      ? "No tasks assigned to you (or sent by you) match these filters. Uncheck “Assigned to me / sent by me” to see the full company inbox."
                      : "No tasks match these filters."}
                  </td>
                </tr>
              ) : (
                sorted.map((task) => (
                  <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={myJobDetailHref(task)}
                        className="cursor-pointer font-medium text-foreground transition-colors duration-200 hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{recordNames[task.id] ?? "—"}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{task.team_role}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={task.status} />
                    </td>
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
                        <span className="text-xs text-muted-foreground">—</span>
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
        description={decision ? decision.task.title : undefined}
        tone={decision?.outcome === "rejected" ? "destructive" : "default"}
        confirmLabel={decision?.outcome === "approved" ? "Approve" : "Reject"}
        busy={deciding}
        contentClassName="max-w-lg"
        onCancel={() => !deciding && setDecision(null)}
        onConfirm={() => void submitDecision()}
      >
        <FinanceField
          label={decision?.outcome === "rejected" ? "Remark *" : "Remark"}
          className="space-y-2"
        >
          <FinanceTextarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Add a remark…"
            className="min-h-[88px] rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80"
          />
        </FinanceField>
        {decideError ? <p className="mt-3 text-xs text-destructive">{decideError}</p> : null}
      </ConfirmDialog>
    </CrmPage>
  );
}
