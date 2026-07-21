"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, RefreshCw, X } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { decideMyJob, listMyJobs, myJobEntityHref, type ApprovalTask } from "@/services/sales-crm-service";

const TEAM_ROLES = ["presales", "project", "management", "accounts", "scm"];
const STATUSES = ["pending", "approved", "rejected", "cancelled"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function MyJobsPage() {
  const [rows, setRows] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [mineOnly, setMineOnly] = useState(false);

  const [decision, setDecision] = useState<{ task: ApprovalTask; outcome: "approved" | "rejected" } | null>(null);
  const [remark, setRemark] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await listMyJobs({
          team_role: teamRole || undefined,
          status: status || undefined,
          mine: mineOnly || undefined,
        }),
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [teamRole, status, mineOnly]);

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

  return (
    <div className="space-y-4">
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
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium tracking-tight">Tasks</h2>
            <Badge variant="secondary">{rows.length} shown</Badge>
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Due</th>
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No tasks match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((task) => (
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
      </div>

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
    </div>
  );
}
