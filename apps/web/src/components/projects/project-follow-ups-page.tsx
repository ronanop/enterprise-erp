"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  ProjectsRecordList,
  type RecordColumn,
} from "@/components/projects/projects-record-list";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ApiClientError } from "@/services/api-client";
import {
  listPortfolioFollowUps,
  replyToPortfolioFollowUp,
  type ProjectPortfolioFollowUp,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees"] as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 16).replace("T", " ");
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectFollowUpsPage() {
  const { projectModuleAdmin } = useAuthUser();
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);
  const [replyTarget, setReplyTarget] = useState<ProjectPortfolioFollowUp | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  const load = useCallback(async () => {
    const [rows] = await Promise.all([listPortfolioFollowUps(), loadLookups()]);
    return rows;
  }, [loadLookups]);

  const columns = useMemo<RecordColumn<ProjectPortfolioFollowUp>[]>(() => {
    const base: RecordColumn<ProjectPortfolioFollowUp>[] = [
      {
        key: "created_at",
        label: "Date",
        sort: (r) => r.created_at ?? "",
        className: "text-muted-foreground whitespace-nowrap",
        cell: (r) => formatDateTime(r.created_at),
      },
      {
        key: "project_name",
        label: "Project",
        sort: (r) => r.project_name,
        cell: (r) => (
          <Link
            href={`/projects/projects/${r.project_id}`}
            className="cursor-pointer font-medium text-foreground hover:underline"
          >
            {r.project_name}
          </Link>
        ),
      },
      {
        key: "document_number",
        label: "Site ID",
        sort: (r) => r.document_number ?? "",
        className: "font-mono text-xs text-muted-foreground",
        cell: (r) => r.document_number ?? "—",
      },
      {
        key: "stage_label",
        label: "Step",
        sort: (r) => r.stage_label,
        className: "font-medium text-foreground",
        cell: (r) => r.stage_label,
      },
      {
        key: "recipient",
        label: projectModuleAdmin ? "Sent to" : "Assigned to you",
        sort: (r) => labels.employeeName(r.recipient_employee_id),
        cell: (r) => labels.employeeName(r.recipient_employee_id),
      },
      {
        key: "note",
        label: "Admin note",
        sort: (r) => r.note ?? "",
        cell: (r) => (
          <span className="line-clamp-2 max-w-xs text-muted-foreground">
            {r.note?.trim() || "—"}
          </span>
        ),
      },
      {
        key: "latest_reply",
        label: "Reply",
        sort: (r) => r.latest_reply ?? "",
        cell: (r) =>
          r.latest_reply?.trim() ? (
            <span className="line-clamp-2 max-w-xs text-foreground" title={r.latest_reply}>
              {r.latest_reply}
            </span>
          ) : (
            <span className="text-xs italic text-muted-foreground">Awaiting reply</span>
          ),
      },
      {
        key: "delivery_status",
        label: "Status",
        sort: (r) => (r.has_reply ? "replied" : r.delivery_status),
        cell: (r) => (
          <span className="capitalize text-muted-foreground">
            {r.has_reply ? "Replied" : r.delivery_status || r.status || "—"}
          </span>
        ),
      },
    ];
    if (!projectModuleAdmin) {
      base.push({
        key: "actions",
        label: "",
        sort: () => "",
        sortable: false,
        className: "text-right",
        cell: (r) =>
          !r.has_reply ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="cursor-pointer"
              onClick={() => {
                setReplyError(null);
                setReplyText("");
                setReplyTarget(r);
              }}
            >
              Reply
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      });
    }
    return base;
  }, [labels, projectModuleAdmin]);

  return (
    <>
      <ProjectsRecordList
        key={listKey}
        title="Follow ups"
        description={
          projectModuleAdmin
            ? "Follow-ups you sent from Project Tracking on site delivery steps."
            : "Follow-ups sent to you for steps you own on assigned projects."
        }
        panelTitle={projectModuleAdmin ? "Sent follow-ups" : "Received follow-ups"}
        panelSubtitle={
          projectModuleAdmin
            ? "Newest first — tied to stage assignees from Assign owners"
            : "Only follow-ups where you are the stage assignee"
        }
        icon={Bell}
        searchPlaceholder="Search project, site, step, or note…"
        emptyMessage={
          projectModuleAdmin
            ? "No follow-ups sent yet. Use Follow up on a project’s tracking table."
            : "No follow-ups received yet."
        }
        loadingMessage="Loading follow-ups…"
        errorMessage="Failed to load follow-ups"
        minWidth={1100}
        columns={columns}
        defaultSortKey="created_at"
        defaultSortDir="desc"
        load={load}
        matches={(r, q) =>
          r.project_name.toLowerCase().includes(q) ||
          r.stage_label.toLowerCase().includes(q) ||
          (r.document_number ?? "").toLowerCase().includes(q) ||
          (r.note ?? "").toLowerCase().includes(q) ||
          (r.message ?? "").toLowerCase().includes(q) ||
          labels.employeeName(r.recipient_employee_id).toLowerCase().includes(q) ||
          (r.latest_reply ?? "").toLowerCase().includes(q)
        }
      />
      <ConfirmDialog
        open={Boolean(replyTarget)}
        title="Reply to follow-up"
        description={
          replyTarget
            ? `${replyTarget.project_name} · ${replyTarget.stage_label}`
            : undefined
        }
        confirmLabel="Send reply"
        cancelLabel="Cancel"
        busy={replyBusy}
        confirmDisabled={!replyText.trim()}
        onCancel={() => {
          if (replyBusy) return;
          setReplyTarget(null);
          setReplyText("");
          setReplyError(null);
        }}
        onConfirm={() => {
          if (!replyTarget || replyBusy) return;
          const text = replyText.trim();
          if (!text) return;
          setReplyBusy(true);
          setReplyError(null);
          void replyToPortfolioFollowUp(replyTarget.id, text)
            .then(() => {
              setReplyTarget(null);
              setReplyText("");
              setListKey((k) => k + 1);
            })
            .catch((err) => {
              setReplyError(
                err instanceof ApiClientError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : "Failed to send reply",
              );
            })
            .finally(() => setReplyBusy(false));
        }}
      >
        {replyTarget ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-foreground">{replyTarget.message}</p>
            {replyTarget.note?.trim() ? (
              <div className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Admin note
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {replyTarget.note.trim()}
                </p>
              </div>
            ) : null}
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Your reply…"
              className="w-full rounded-md border border-border/80 bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              disabled={replyBusy}
            />
            {replyError ? (
              <p className="text-xs text-destructive" role="alert">
                {replyError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
