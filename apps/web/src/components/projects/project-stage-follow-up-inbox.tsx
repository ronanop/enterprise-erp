"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ApiClientError } from "@/services/api-client";
import {
  listPortfolioFollowUps,
  replyToPortfolioFollowUp,
  type ProjectPortfolioFollowUp,
} from "@/services/projects-portal-service";

const POLL_MS = 45_000;

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

function followUpAdminNote(item: ProjectPortfolioFollowUp): string | null {
  const fromField = item.note?.trim();
  if (fromField) return fromField;
  const msg = item.message?.trim() ?? "";
  const prefix = "Note:";
  const idx = msg.indexOf(prefix);
  if (idx >= 0) {
    const extracted = msg.slice(idx + prefix.length).trim();
    return extracted || null;
  }
  return null;
}

/**
 * Shows a modal on the assignee's Projects portal when an admin sends a stage follow-up
 * that has not been replied to yet.
 */
export function ProjectStageFollowUpInbox() {
  const { projectModuleAdmin, loading: authLoading } = useAuthUser();
  const [rows, setRows] = useState<ProjectPortfolioFollowUp[]>([]);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (projectModuleAdmin) return;
    try {
      const list = await listPortfolioFollowUps();
      setRows(Array.isArray(list) ? list : []);
    } catch {
      /* ignore poll errors */
    }
  }, [projectModuleAdmin]);

  useEffect(() => {
    if (authLoading || projectModuleAdmin) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [authLoading, projectModuleAdmin, refresh]);

  const pending = useMemo(() => {
    return rows
      .filter((r) => !r.has_reply && !(r.replies?.length))
      .filter((r) => !snoozedIds.has(r.id))
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  }, [rows, snoozedIds]);

  const active = pending[0] ?? null;
  const adminNote = active ? followUpAdminNote(active) : null;

  useEffect(() => {
    if (!active) {
      setReplyText("");
      setError(null);
      setValidationError(null);
    }
  }, [active?.id]);

  const submitReply = useCallback(() => {
    if (!active || busy) return;
    const text = replyText.trim();
    if (!text) {
      setValidationError("Enter a reply before sending.");
      return;
    }
    setBusy(true);
    setError(null);
    setValidationError(null);
    void replyToPortfolioFollowUp(active.id, text)
      .then(() => {
        setReplyText("");
        setSnoozedIds((prev) => {
          const next = new Set(prev);
          next.delete(active.id);
          return next;
        });
        return refresh();
      })
      .catch((err) => {
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to send reply",
        );
      })
      .finally(() => setBusy(false));
  }, [active, busy, replyText, refresh]);

  if (authLoading || projectModuleAdmin || !active) {
    return null;
  }

  const projectLabel = active.project_name || "Project";
  const siteLabel = active.site_name || active.document_number || "Site";

  return (
    <ConfirmDialog
      open
      title="Follow-up from project admin"
      description={`${projectLabel} · ${siteLabel} · ${active.stage_label}`}
      confirmLabel="Send reply"
      cancelLabel="Remind me later"
      busy={busy}
      confirmDisabled={!replyText.trim()}
      onCancel={() => {
        if (busy) return;
        setSnoozedIds((prev) => new Set(prev).add(active.id));
        setReplyText("");
        setError(null);
        setValidationError(null);
      }}
      onConfirm={submitReply}
    >
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submitReply();
        }}
      >
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/25 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Bell className="size-3.5 shrink-0" aria-hidden />
            Admin request
          </div>
          <p className="text-sm text-foreground">{active.message}</p>
          {adminNote ? (
            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Admin note
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {adminNote}
              </p>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Sent {formatDateTime(active.sent_at ?? active.created_at)}
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Your reply
          </span>
          <textarea
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            rows={4}
            placeholder="Describe progress, blockers, or ETA…"
            className="w-full rounded-md border border-border/80 bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            disabled={busy}
          />
        </label>
        {validationError ? (
          <p className="text-xs text-destructive" role="alert">
            {validationError}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Your reply is sent to the project admin and appears on Project Tracking. You can also use{" "}
          <Link
            href="/projects/follow-ups"
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            Follow ups
          </Link>
          .
        </p>
      </form>
    </ConfirmDialog>
  );
}
