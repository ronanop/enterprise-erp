"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Edit, Paperclip, RefreshCw, UserPlus, Users } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ServicePageNoticeHost } from "@/components/service/service-page-notice";
import { SlaHistoryTimeline } from "@/components/service/slas/sla-history-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatServiceDisplayText } from "@/lib/service-display-text";
import { authService } from "@/services/api-client";
import {
  addTicketCoOwner,
  addTicketFieldEngineer,
  ApiClientError,
  approveReopenRequest,
  assignTicketOwner,
  closeTicket,
  confirmAssetDetails,
  deleteTicketAttachment,
  exportTicketTimelineXlsx,
  formatDurationMinutes,
  formatInr,
  formatStatus,
  getAssignmentHistory,
  getCircuitHistory,
  getServiceRequestTicket,
  getTicketStakeholderView,
  getTicketTimeline,
  listAssignableEmployees,
  listTicketAttachments,
  loadTicketFormLookups,
  markFieldEngineerSolved,
  openTicket,
  openTicketAttachment,
  pauseTicketSla,
  rejectReopenRequest,
  removeTicketCoOwner,
  removeTicketFieldEngineer,
  requestReopen,
  resolveTicket,
  resumeTicketSla,
  ticketStatusLabel,
  updateServiceRequestTicket,
  updateTicketFieldEngineer,
  SOLUTION_TYPES,
  type AssignmentHistoryItem,
  type CircuitHistory,
  type LookupOption,
  type TicketReopenRequest,
  type ServiceRequestTicket,
  type TicketAttachment,
  type TicketFieldEngineer,
  type TicketSlaPauseItem,
  type TicketStakeholderView,
  type TimelineItem,
  uploadTicketAttachment,
} from "@/services/service-request-ticket-service";

function AttachmentOpenLink({
  ticketId,
  attachmentId,
  fileName,
  className,
}: {
  ticketId: string;
  attachmentId: string;
  fileName: string;
  className?: string;
}) {
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      disabled={opening}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 text-left font-medium text-primary hover:underline disabled:opacity-60",
        className,
      )}
      onClick={() => {
        setOpening(true);
        void openTicketAttachment(ticketId, attachmentId)
          .catch(() => {
            // Keep UX quiet; parent pages already surface load errors elsewhere.
          })
          .finally(() => setOpening(false));
      }}
    >
      <Paperclip className="size-3.5 shrink-0" />
      <span className="truncate">{opening ? "Opening…" : fileName}</span>
    </button>
  );
}

const detailFieldShell =
  "min-w-0 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm";
const detailLabelCls =
  "text-[11px] font-bold tracking-wide text-foreground/80 uppercase";
const detailControlCls =
  "mt-1.5 w-full rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-sm font-semibold text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function DetailRow({ label, value, emptyText = "—" }: { label: string; value?: string | null; emptyText?: string }) {
  const display = value?.trim() ? formatServiceDisplayText(value) : emptyText;
  const empty = !value?.trim();
  return (
    <div className={detailFieldShell}>
      <dt className={detailLabelCls}>{label}</dt>
      <dd
        className={cn(
          "mt-1.5 max-w-full break-words text-sm leading-snug [overflow-wrap:anywhere]",
          empty ? "font-medium text-muted-foreground/70" : "font-bold text-foreground",
        )}
      >
        {display}
      </dd>
    </div>
  );
}

function DetailSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: LookupOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={detailFieldShell}>
      <label className={detailLabelCls}>{label}</label>
      <select className={detailControlCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ManualEditBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 inline-flex rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300">
      Manual
    </span>
  );
}

function DetailInput({
  label,
  value,
  type = "text",
  placeholder,
  manual,
  onCommit,
}: {
  label: string;
  value?: string | null;
  type?: string;
  placeholder?: string;
  manual?: boolean;
  onCommit: (value: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);
  return (
    <div className={detailFieldShell}>
      <label className={cn("flex items-center", detailLabelCls)}>
        {label}
        <ManualEditBadge show={manual} />
      </label>
      <input
        type={type}
        className={detailControlCls}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const next = local.trim();
          const prev = (value ?? "").trim();
          if (next !== prev) onCommit(next || null);
        }}
      />
    </div>
  );
}

function yesNoFromApi(value: boolean | string | null | undefined): boolean {
  if (typeof value === "string") return value.toLowerCase() === "yes" || value === "true";
  return Boolean(value);
}

function DetailTextarea({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onCommit: (value: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);
  return (
    <div className={cn(detailFieldShell, "sm:col-span-2")}>
      <label className={detailLabelCls}>{label}</label>
      <textarea
        className={cn(detailControlCls, "min-h-20 font-medium leading-relaxed")}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const next = local.trim();
          const prev = (value ?? "").trim();
          if (next !== prev) onCommit(next || null);
        }}
      />
    </div>
  );
}

function optionLabel(options: LookupOption[], code?: string | null): string | null {
  if (!code) return null;
  return options.find((o) => o.value === code)?.label ?? formatStatus(code);
}

function ModalShell({
  titleId,
  title,
  description,
  busy,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-sm font-medium tracking-tight">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

function ReasonDialog({
  titleId,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  busyLabel,
  required,
  busy,
  onConfirm,
  onClose,
}: {
  titleId: string;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  busyLabel: string;
  required?: boolean;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ModalShell titleId={titleId} title={title} description={description} busy={busy} onClose={onClose}>
      <label className="mt-4 mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </label>
      <textarea
        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        placeholder={placeholder}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || (required && !reason.trim())}
          onClick={() => onConfirm(reason.trim())}
        >
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid min-w-0 gap-2.5 sm:grid-cols-2">{children}</dl>;
}

function ProseBlock({ children }: { children: ReactNode }) {
  const content =
    typeof children === "string" || typeof children === "number"
      ? formatServiceDisplayText(String(children))
      : children;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-lg border border-border/70 bg-background/80 px-3.5 py-3 text-sm font-semibold leading-relaxed break-words whitespace-pre-wrap shadow-sm [overflow-wrap:anywhere] text-foreground">
      {content}
    </div>
  );
}

function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div
      className={cn(
        detailFieldShell,
        "[&_input]:mt-0 [&_input]:h-9 [&_input]:rounded-md [&_input]:border-border/80 [&_input]:bg-background [&_input]:px-2.5 [&_input]:text-sm [&_input]:font-semibold",
        "[&_select]:mt-0 [&_select]:h-9 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-border/80 [&_select]:bg-background [&_select]:px-2.5 [&_select]:text-sm [&_select]:font-semibold",
        "[&_textarea]:mt-0 [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-border/80 [&_textarea]:bg-background [&_textarea]:px-2.5 [&_textarea]:py-2 [&_textarea]:text-sm [&_textarea]:font-semibold",
      )}
    >
      <label className={cn("mb-1.5 block", detailLabelCls)}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function formatTimelineWhen(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const raw = iso.slice(0, 16).replace("T", " ");
    const [date = raw, time = ""] = raw.split(" ");
    return { date, time };
  }
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function timelineEventMeta(eventType: string): { label: string; tone: string } {
  switch (eventType) {
    case "ticket_start":
      return { label: "Ticket created", tone: "bg-sky-500/15 text-sky-800 dark:text-sky-300" };
    case "ticket_opened":
      return { label: "Opened", tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" };
    case "ticket_resolved":
      return { label: "Resolved", tone: "bg-violet-500/15 text-violet-800 dark:text-violet-300" };
    case "ticket_end":
      return { label: "Closed", tone: "bg-slate-500/15 text-slate-800 dark:text-slate-300" };
    case "sla_pause":
      return { label: "SLA paused", tone: "bg-amber-500/15 text-amber-900 dark:text-amber-300" };
    case "sla_resume":
      return { label: "SLA resumed", tone: "bg-teal-500/15 text-teal-800 dark:text-teal-300" };
    case "status_change":
      return { label: "Status change", tone: "bg-blue-500/15 text-blue-800 dark:text-blue-300" };
    case "field_engineer_solved":
      return { label: "FE completed", tone: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300" };
    case "comment":
      return { label: "Comment", tone: "bg-muted text-muted-foreground" };
    default:
      return { label: formatStatus(eventType), tone: "bg-muted text-muted-foreground" };
  }
}

function TimelineDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs leading-snug">
      <dt className="pt-px font-semibold tracking-wide text-foreground/80">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function TicketTimelinePanel({
  items,
  onExport,
}: {
  items: TimelineItem[];
  onExport: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{items.length}</span> event
          {items.length === 1 ? "" : "s"} · newest first
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          Export Excel
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <ol className="relative max-h-[28rem] space-y-0 overflow-y-auto pr-1">
          {items.map((item, i) => {
            const meta = timelineEventMeta(item.event_type);
            const when = formatTimelineWhen(item.occurred_at);
            const fromStatus = item.from_status;
            const toStatus = item.to_status;
            const isStatus = item.event_type === "status_change";
            const note = item.description ? formatServiceDisplayText(item.description) : null;

            return (
              <li key={`${item.occurred_at}-${item.event_type}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex w-3 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card",
                      item.event_type === "sla_pause"
                        ? "bg-amber-500"
                        : item.event_type === "ticket_resolved" || item.event_type === "ticket_end"
                          ? "bg-violet-500"
                          : item.event_type === "ticket_opened"
                            ? "bg-emerald-500"
                            : "bg-primary",
                    )}
                    aria-hidden
                  />
                  {i < items.length - 1 ? <span className="mt-1 w-px flex-1 bg-border/80" aria-hidden /> : null}
                </div>

                <div className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase", meta.tone)}>
                      {meta.label}
                    </span>
                    <time className="text-[11px] tabular-nums text-muted-foreground" dateTime={item.occurred_at}>
                      <span className="font-semibold text-foreground/80">{when.date}</span>
                      {when.time ? <> · {when.time}</> : null}
                    </time>
                  </div>

                  <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
                    {isStatus ? "Ticket status updated" : item.title}
                  </p>

                  <dl className="mt-2 space-y-1.5">
                    {isStatus && (fromStatus || toStatus) ? (
                      <>
                        <TimelineDetailRow label="From">
                          <span className="font-bold">{formatStatus(fromStatus || "—")}</span>
                        </TimelineDetailRow>
                        <TimelineDetailRow label="To">
                          <span className="font-bold">{formatStatus(toStatus || "—")}</span>
                        </TimelineDetailRow>
                      </>
                    ) : null}
                    {item.event_type === "sla_pause" && note ? (
                      <TimelineDetailRow label="Reason">
                        <span className="font-bold">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {item.event_type === "sla_resume" && note ? (
                      <TimelineDetailRow label="Resume">
                        <span className="font-semibold">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {item.event_type === "ticket_resolved" && note ? (
                      <TimelineDetailRow label="Solution">
                        <span className="font-semibold">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {item.event_type === "field_engineer_solved" && note ? (
                      <TimelineDetailRow label="Work done">
                        <span className="font-semibold">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {item.event_type === "comment" && note ? (
                      <TimelineDetailRow label="Comment">
                        <span className="font-medium">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {isStatus && note ? (
                      <TimelineDetailRow label="Note">
                        <span className="font-semibold">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                    {!isStatus &&
                    !["sla_pause", "sla_resume", "ticket_resolved", "field_engineer_solved", "comment"].includes(
                      item.event_type,
                    ) &&
                    note ? (
                      <TimelineDetailRow label="Detail">
                        <span className="font-medium">{note}</span>
                      </TimelineDetailRow>
                    ) : null}
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/35 px-4 py-2.5">
        <h2 className="text-xs font-bold tracking-[0.08em] text-foreground uppercase">{title}</h2>
      </div>
      <div className="min-w-0 overflow-x-hidden p-4">{children}</div>
    </section>
  );
}

function FieldEngineerStatusCard({
  fieldEngineers,
  ticketId,
}: {
  fieldEngineers: TicketFieldEngineer[];
  ticketId: string;
}) {
  if (fieldEngineers.length === 0) {
    return (
      <SectionCard title="Field Engineer Status">
        <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
          No field engineer involved
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Field Engineer Status">
      <ul className="space-y-3">
        {fieldEngineers.map((fe) => (
          <li
            key={fe.id}
            className={cn(
              "rounded-md border px-3 py-3",
              fe.status === "solved"
                ? "border-primary/25 bg-accent/40"
                : "border-border/60 bg-muted/20",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{fe.engineer_name}</div>
                <div className="truncate text-xs text-muted-foreground">{fe.engineer_email || "—"}</div>
              </div>
              <Badge
                variant={fe.status === "solved" ? "secondary" : "outline"}
                className="font-medium capitalize"
              >
                {fe.status === "solved" ? "Completed" : formatStatus(fe.status)}
              </Badge>
            </div>
            {fe.status === "solved" ? (
              <div className="mt-3 space-y-2">
                <ProseBlock>{fe.solution_summary || "—"}</ProseBlock>
                {fe.solved_at ? (
                  <p className="text-xs text-muted-foreground">
                    Submitted {fe.solved_at.slice(0, 16).replace("T", " ")}
                  </p>
                ) : null}
                {(fe.attachments ?? []).length > 0 ? (
                  <ul className="space-y-1">
                    {fe.attachments?.map((a) => (
                      <li key={a.id}>
                        <AttachmentOpenLink
                          ticketId={ticketId}
                          attachmentId={a.id}
                          fileName={a.file_name}
                          className="rounded-md border border-border/50 bg-background px-2 py-1 text-xs"
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {fe.work_brief
                  ? "Visit brief recorded — mark complete on this ticket after the visit."
                  : "Awaiting on-site visit — mark complete on this ticket when done."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TicketAttachmentsCard({
  attachments,
  ticketId,
  fieldEngineers,
  canUpload,
  onUpload,
  onDelete,
}: {
  attachments: TicketAttachment[];
  ticketId: string;
  fieldEngineers: TicketFieldEngineer[];
  canUpload: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (attachmentId: string) => void;
}) {
  return (
    <SectionCard title="Attachments">
      {canUpload ? (
        <div className="mb-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted/40">
            <Paperclip className="size-4" />
            Upload file (max 40MB)
            <input type="file" className="hidden" onChange={onUpload} />
          </label>
        </div>
      ) : null}
      <ul className="space-y-2">
        {attachments.length === 0 ? (
          <li className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
            No attachments.
          </li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <AttachmentOpenLink
                    ticketId={ticketId}
                    attachmentId={a.id}
                    fileName={a.file_name}
                  />
                  {a.field_engineer_id ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      From field engineer
                      {fieldEngineers.find((fe) => fe.id === a.field_engineer_id)?.engineer_name
                        ? ` · ${fieldEngineers.find((fe) => fe.id === a.field_engineer_id)?.engineer_name}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {a.file_size ? `${Math.round(a.file_size / 1024)} KB` : "—"}
                  </span>
                  {canUpload ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(a.id)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}

function StakeholderStatusCard({ view }: { view: TicketStakeholderView }) {
  const feWork = view.field_engineer_work ?? [];
  const showWork = view.is_resolved || view.is_closed;

  return (
    <div className="space-y-4">
      <PageHeader
        title={view.subject}
        description={`${view.document_number} · Status view only`}
      />
      <SectionCard title="Ticket Status">
        <DetailGrid>
          <DetailRow label="Status" value={formatStatus(view.status)} />
          <DetailRow label="Resolved" value={view.is_resolved ? "Yes" : "No"} />
          <DetailRow label="Closed" value={view.is_closed ? "Yes" : "No"} />
          <DetailRow label="Resolved At" value={view.resolved_at?.slice(0, 16) ?? null} />
          <DetailRow label="Closed At" value={view.closed_at?.slice(0, 16) ?? null} />
        </DetailGrid>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          You are listed as a contact on this ticket. Communication happens via email; this portal shows resolution status and completed work.
        </p>
      </SectionCard>

      {showWork ? (
        <SectionCard title="Work completed">
          <div className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-3">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Service Engineer solution
              </p>
              <div className="mt-2">
                <DetailGrid>
                  <DetailRow
                    label="Type"
                    value={view.solution_type ? formatStatus(view.solution_type) : null}
                  />
                  <DetailRow label="Resolved At" value={view.resolved_at?.slice(0, 16) ?? null} />
                </DetailGrid>
              </div>
              <div className="mt-2">
                <ProseBlock>{view.solution_summary || "No solution summary recorded."}</ProseBlock>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Field Engineer work
              </p>
              {feWork.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
                  No field engineer involved
                </p>
              ) : (
                <ul className="space-y-3">
                  {feWork.map((fe, idx) => (
                    <li
                      key={`${fe.engineer_email ?? fe.engineer_name}-${idx}`}
                      className="rounded-md border border-border/60 bg-background px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{fe.engineer_name}</div>
                          {fe.engineer_email ? (
                            <div className="text-xs text-muted-foreground">{fe.engineer_email}</div>
                          ) : null}
                        </div>
                        <span className="text-xs font-medium tracking-wide uppercase">
                          {fe.status === "solved" ? "Solved" : formatStatus(fe.status)}
                        </span>
                      </div>
                      {fe.work_brief ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Brief</p>
                          <ProseBlock>{fe.work_brief}</ProseBlock>
                        </div>
                      ) : null}
                      {fe.status === "solved" ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            What they did
                          </p>
                          <ProseBlock>{fe.solution_summary || "—"}</ProseBlock>
                          {fe.solved_at ? (
                            <p className="text-xs text-muted-foreground">
                              Submitted {fe.solved_at.slice(0, 16).replace("T", " ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No work submitted by this field engineer.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

export function ServiceRequestTicketDetailPage({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<ServiceRequestTicket | null>(null);
  const [stakeholderView, setStakeholderView] = useState<TicketStakeholderView | null>(null);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [employees, setEmployees] = useState<LookupOption[]>([]);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [coOwnerId, setCoOwnerId] = useState("");
  const [feBrief, setFeBrief] = useState("");
  const [feShowIssue, setFeShowIssue] = useState(true);
  const [feShowCustomer, setFeShowCustomer] = useState(true);
  const [feShowSite, setFeShowSite] = useState(true);
  const [feShowAsset, setFeShowAsset] = useState(true);
  const [feShowCircuit, setFeShowCircuit] = useState(true);
  const [editingFeId, setEditingFeId] = useState<string | null>(null);
  const [visitName, setVisitName] = useState("");
  const [visitContact, setVisitContact] = useState("");
  const [visitCarrying, setVisitCarrying] = useState("false");
  const [visitDate, setVisitDate] = useState("");
  const [visitHw, setVisitHw] = useState("");
  const [visitHwRepair, setVisitHwRepair] = useState("false");
  /** false | hardware | software | device — any non-false requires New Device SR No. */
  const [visitHwReplacement, setVisitHwReplacement] = useState("false");
  const [visitNewSerial, setVisitNewSerial] = useState("");
  const [visitTransport, setVisitTransport] = useState("");
  const [visitMovement, setVisitMovement] = useState("");
  const [visitChargesAmt, setVisitChargesAmt] = useState("");
  const [visitOtherCharges, setVisitOtherCharges] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [visitEmail, setVisitEmail] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [modeOptions, setModeOptions] = useState<LookupOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<LookupOption[]>([]);
  const [issueOptions, setIssueOptions] = useState<LookupOption[]>([]);
  const [resolutionOptions, setResolutionOptions] = useState<LookupOption[]>([]);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveIssue, setResolveIssue] = useState("");
  const [resolveResolution, setResolveResolution] = useState("");
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [resolveNewSerial, setResolveNewSerial] = useState("");
  const [resolving, setResolving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);
  const [slaPauseOpen, setSlaPauseOpen] = useState(false);
  const [slaBusy, setSlaBusy] = useState(false);
  const [circuitHistory, setCircuitHistory] = useState<CircuitHistory | null>(null);
  const [circuitHistoryLoading, setCircuitHistoryLoading] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canAssign, setCanAssign] = useState(false);

  const loadTicket = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    setError(null);
    setStakeholderView(null);
    try {
      const me = await authService.me();
      const perms = (me.data as { permissions?: string[] })?.permissions ?? [];
      setCanAssign(perms.includes("service.request:approve"));

      const lookups = await loadTicketFormLookups();
      const assignees = await listAssignableEmployees();
      setEmployees(assignees.length > 0 ? assignees : lookups.employees);
      setModeOptions(lookups.modes);
      setCategoryOptions(lookups.ticketCategories);
      setIssueOptions(lookups.issueReportedOptions);
      setResolutionOptions(lookups.resolutionCommentOptions);

      try {
        const t = await getServiceRequestTicket(ticketId);
        setTicket(t);
        getAssignmentHistory(ticketId)
          .then(setAssignmentHistory)
          .catch(() => setAssignmentHistory([]));
        // Always load timeline/attachments for anyone who can open ticket detail
        // (Service Head is view_only on assigned tickets and previously got an empty timeline).
        try {
          const [a, tl] = await Promise.all([
            listTicketAttachments(ticketId),
            getTicketTimeline(ticketId),
          ]);
          setAttachments(a);
          setTimeline(tl);
        } catch {
          setAttachments([]);
          setTimeline([]);
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 403) {
          const sv = await getTicketStakeholderView(ticketId);
          setStakeholderView(sv);
          setTicket(null);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const load = useCallback(() => loadTicket(false), [loadTicket]);
  /** Reload without unmounting the page (keeps unsaved local UI state). */
  const reloadSilent = useCallback(() => loadTicket(true), [loadTicket]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fe = ticket?.field_engineer;
    setVisitName(fe?.engineer_name ?? "");
    setVisitContact(fe?.engineer_contact ?? "");
    setVisitCarrying(fe?.carrying_spares ? "true" : "false");
    setVisitDate(fe?.visit_date?.slice(0, 10) ?? "");
    setVisitHw(fe?.hw_replacement ?? "");
    setVisitHwRepair(yesNoFromApi(fe?.hardware_repair) ? "true" : "false");
    {
      const replaced =
        yesNoFromApi(fe?.hardware_replacement) || fe?.hardware_replacement_yn?.toLowerCase() === "yes";
      const detail = (fe?.hw_replacement || "").toLowerCase();
      if (!replaced) setVisitHwReplacement("false");
      else if (detail.includes("software")) setVisitHwReplacement("software");
      else if (detail.includes("device")) setVisitHwReplacement("device");
      else setVisitHwReplacement("hardware");
    }
    setVisitNewSerial(fe?.new_device_serial ?? "");
    setVisitTransport(fe?.transport_mode ?? "");
    setVisitMovement(fe?.movement_charges != null ? String(fe.movement_charges) : "");
    setVisitChargesAmt(fe?.visit_charges != null ? String(fe.visit_charges) : "");
    setVisitOtherCharges(fe?.other_charges != null ? String(fe.other_charges) : "");
    setVisitRemarks(fe?.remarks ?? "");
  }, [ticket?.id, ticket?.field_engineer]);

  const circuitKey = useMemo(() => {
    const raw = (ticket?.ckt_id || ticket?.lsi || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    if (["NA", "N/A", "N.A.", "NONE", "-", "--", "NULL"].includes(upper)) return "";
    return raw;
  }, [ticket?.ckt_id, ticket?.lsi]);
  useEffect(() => {
    if (!ticket?.id || !circuitKey) {
      setCircuitHistory(null);
      setCircuitHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setCircuitHistoryLoading(true);
    // Debounce so rapid circuit edits don't spam the history endpoint.
    const timer = window.setTimeout(() => {
      getCircuitHistory(ticket.id)
        .then((h) => {
          if (!cancelled) setCircuitHistory(h);
        })
        .catch(() => {
          if (!cancelled) setCircuitHistory(null);
        })
        .finally(() => {
          if (!cancelled) setCircuitHistoryLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ticket?.id, circuitKey]);

  const access = ticket?.access;
  const canWork = access?.can_work ?? false;
  const canOpen = access?.can_open ?? false;
  const canManage = access?.can_manage_collaborators ?? false;
  const isPreview = access?.level === "assign_preview";
  const isViewOnly = access?.level === "view_only";
  const isOpened = Boolean(
    ticket?.opened_at ||
      (ticket &&
        ["engineer_working", "pending_customer", "pending_oem", "resolved", "closed"].includes(ticket.status)),
  );
  const modeFixed = Boolean(ticket?.mode_of_action?.trim());
  const categoryFixed = Boolean(ticket?.ticket_category?.trim());
  const supportChosen = modeFixed && categoryFixed;
  const ticketEnded = ticket?.status === "closed" || ticket?.status === "resolved";
  const ticketClosed = ticket?.status === "closed";
  // Resolution Mode stays changeable until the ticket is resolved/closed.
  const canChooseMode = canWork && isOpened && !ticketEnded;
  const canChooseCategory = canWork && isOpened && !categoryFixed;
  const needsSupportChoice = canWork && isOpened && !supportChosen;
  const assetConfirmed = Boolean(ticket?.asset_confirmed_at);
  const isOnsiteMode = ticket?.mode_of_action === "onsite_support";
  const isOemMode = ticket?.mode_of_action === "oem_support";
  // Field Engineer Visit: only for Onsite Support with confirmed asset (OEM is a separate placeholder section).
  const showFieldEngineers = supportChosen && isOnsiteMode && assetConfirmed;
  const fieldEngineers = ticket?.field_engineers ?? [];
  const hasFieldEngineers = fieldEngineers.length > 0;
  const needsAssetConfirm = canWork && isOpened && !ticketEnded && !assetConfirmed;
  // FE visit details stay editable until Close (visible after Resolve too).
  const canEditVisitPlan = canWork && showFieldEngineers && !ticketClosed;
  const showVisitSection = showFieldEngineers && (canEditVisitPlan || Boolean(ticket?.field_engineer) || hasFieldEngineers);
  const canEditResolutionFields = canWork && isOpened && !ticketEnded;
  const canResolve = canWork && isOpened && !ticketEnded;
  const canClose = ticket?.status === "resolved" && (access?.can_close ?? canWork);
  const slaIsPaused = Boolean(ticket?.sla_is_paused || ticket?.sla_paused_at);
  const canPauseSla = Boolean(access?.can_pause_sla);
  const canResumeSla = Boolean(access?.can_resume_sla);
  const slaPauses: TicketSlaPauseItem[] = ticket?.sla_pauses ?? [];
  const pendingReopen: TicketReopenRequest | null =
    ticket?.pending_reopen_request ??
    (ticket?.reopen_request?.status === "pending" ? ticket.reopen_request : null);
  const lastReopenDecision =
    !pendingReopen && ticket?.reopen_request && ticket.reopen_request.status !== "pending"
      ? ticket.reopen_request
      : null;
  // Reopen is only for closed tickets (resolve ≠ close). Owner/co-owner request; manager approves.
  const canRequestReopen =
    ticketClosed && !pendingReopen && Boolean(access?.can_request_reopen ?? access?.can_reopen);
  const canApproveReopen =
    ticketClosed &&
    Boolean(pendingReopen) &&
    (Boolean(access?.is_manager) || Boolean(access?.can_approve_reopen));
  const visitTotalComputed = useMemo(() => {
    const parts = [visitChargesAmt, visitMovement, visitOtherCharges].map((v) => Number(v));
    if (!visitChargesAmt && !visitMovement && !visitOtherCharges) return null;
    return parts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  }, [visitChargesAmt, visitMovement, visitOtherCharges]);
  const resolveMissing = useMemo(() => {
    const missing: string[] = [];
    if (!ticket?.mode_of_action?.trim()) missing.push("Resolution Mode");
    if (!ticket?.ticket_category?.trim()) missing.push("Category");
    if (!assetConfirmed) missing.push("Confirmed asset details");
    if (!resolveIssue) missing.push("Issue Reported");
    if (!resolveResolution) missing.push("Resolution Comment");
    return missing;
  }, [ticket?.mode_of_action, ticket?.ticket_category, assetConfirmed, resolveIssue, resolveResolution]);

  const pageNotices = useMemo(() => {
    const items: Array<{ id: string; message: ReactNode; tone?: "info" | "warning" | "neutral" }> = [];
    const isOwnerOrCo = Boolean(access?.is_owner || access?.is_co_owner);

    if (ticketClosed) {
      items.push({
        id: "ticket-closed",
        tone: "info",
        message: pendingReopen
          ? "This ticket is closed. A reopen request is pending approval."
          : isOwnerOrCo
            ? "This ticket is closed. Work is locked; request reopen if more work is needed."
            : "This ticket is closed. Ownership stays with the assigned engineer until a reopen is approved.",
      });
      return items;
    }

    if (ticket?.status === "resolved") {
      items.push({
        id: "ticket-resolved",
        tone: "info",
        message: isOwnerOrCo
          ? "Ticket is resolved. Review visit/charges if needed, then Close to finish."
          : "Ticket is resolved and waiting for the owner to close it.",
      });
    }

    if (isViewOnly) {
      items.push({
        id: "view-only",
        tone: "info",
        message:
          "View-only access. As service head you can see this ticket but cannot open or work on it. SLA starts when the ticket is created or the email is received.",
      });
    }

    if (isPreview) {
      items.push({
        id: "assign-preview",
        tone: "warning",
        message:
          "This ticket is unassigned. Everyone in the service module can see it here. A coordinator must assign an owner before work can begin.",
      });
    }

    if (needsSupportChoice) {
      items.push({
        id: "support-choice",
        tone: "warning",
        message: (
          <>
            Ticket is open. Choose <span className="font-medium">Resolution Mode</span> and{" "}
            <span className="font-medium">Category</span> in Basic Information to continue.
          </>
        ),
      });
    }

    if (needsAssetConfirm) {
      items.push({
        id: "asset-confirm",
        tone: "warning",
        message: (
          <>
            Asset details are taken from the email. Review them below — fill anything missing or change what is wrong, then{" "}
            <span className="font-medium">Confirm asset details</span> before continuing work.
          </>
        ),
      });
    }

    // Only for active tickets assigned to someone else — never after resolve/close.
    if (!canWork && !isPreview && !isViewOnly && !canOpen && !isOwnerOrCo && !ticketEnded) {
      items.push({
        id: "other-owner",
        tone: "neutral",
        message:
          "This ticket is assigned to another engineer. Only the owner and co-owners can open and work on it.",
      });
    }

    return items;
  }, [
    access?.is_co_owner,
    access?.is_owner,
    canOpen,
    canWork,
    isPreview,
    isViewOnly,
    needsAssetConfirm,
    needsSupportChoice,
    pendingReopen,
    ticket?.status,
    ticketClosed,
    ticketEnded,
  ]);

  const onOpenTicket = async () => {
    await openTicket(ticketId);
    await load();
  };

  const onAssign = async () => {
    if (!assignOwnerId) return;
    await assignTicketOwner(ticketId, assignOwnerId);
    setAssignOwnerId("");
    await load();
  };

  const onAddCoOwner = async () => {
    if (!coOwnerId) return;
    await addTicketCoOwner(ticketId, coOwnerId);
    setCoOwnerId("");
    await load();
  };

  const deviceWasReplaced = visitHwReplacement !== "false";
  const replacementTypeLabel =
    visitHwReplacement === "software"
      ? "Software replaced"
      : visitHwReplacement === "device"
        ? "Device replaced"
        : visitHwReplacement === "hardware"
          ? "Hardware replaced"
          : null;

  const saveVisitPayload = () => ({
    engineer_name: visitName.trim(),
    engineer_contact: visitContact.trim() || null,
    carrying_spares: visitCarrying === "true",
    visit_date: visitDate || null,
    hw_replacement: deviceWasReplaced
      ? [replacementTypeLabel, visitHw.trim()].filter(Boolean).join(" — ") || replacementTypeLabel
      : visitHw.trim() || null,
    hardware_repair: visitHwRepair === "true" ? "yes" : "no",
    hardware_replacement_yn: deviceWasReplaced ? "yes" : "no",
    new_device_serial: deviceWasReplaced ? visitNewSerial.trim() || null : null,
    transport_mode: visitTransport.trim() || null,
    movement_charges: visitMovement ? Number(visitMovement) : null,
    visit_charges: visitChargesAmt ? Number(visitChargesAmt) : null,
    other_charges: visitOtherCharges ? Number(visitOtherCharges) : null,
    total_charges: visitTotalComputed,
    remarks: visitRemarks.trim() || null,
  });

  /** Patch an email-extracted field and flag it as manually overridden. */
  const patchExtractedField = async (field: string, value: string | null, failMessage: string) => {
    try {
      await updateServiceRequestTicket(ticketId, {
        [field]: value,
        field_manual_overrides: { ...(ticket?.field_manual_overrides ?? {}), [field]: true },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : failMessage);
    }
  };

  const patchTicketField = async (field: string, value: string | null, failMessage: string) => {
    try {
      await updateServiceRequestTicket(ticketId, { [field]: value });
      await reloadSilent();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : failMessage);
    }
  };

  const onConfirmAsset = async () => {
    try {
      await confirmAssetDetails(ticketId);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to confirm asset details");
    }
  };

  const onUpdateVisitDetails = async () => {
    if (!visitName.trim()) {
      setError("Enter field engineer name.");
      return;
    }
    if (deviceWasReplaced && !visitNewSerial.trim()) {
      setError("Enter New Device SR No. when hardware / software / device is replaced.");
      return;
    }
    setSavingVisit(true);
    setError(null);
    try {
      const payload = saveVisitPayload();
      await updateServiceRequestTicket(ticketId, {
        field_engineer: payload,
        ...(deviceWasReplaced && visitNewSerial.trim()
          ? { serial_number: visitNewSerial.trim() }
          : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save visit details");
    } finally {
      setSavingVisit(false);
    }
  };

  const resetFeForm = () => {
    setVisitEmail("");
    setFeBrief("");
    setFeShowIssue(true);
    setFeShowCustomer(true);
    setFeShowSite(true);
    setFeShowAsset(true);
    setFeShowCircuit(true);
    setEditingFeId(null);
  };

  const startEditFe = (fe: TicketFieldEngineer) => {
    setEditingFeId(fe.id);
    setVisitName(fe.engineer_name);
    setVisitEmail(fe.engineer_email);
    setVisitContact(fe.engineer_contact || "");
    if (fe.assigned_date) setVisitDate(fe.assigned_date.slice(0, 10));
    setFeBrief(fe.work_brief || "");
    setFeShowIssue(fe.show_issue !== false);
    setFeShowCustomer(fe.show_customer !== false);
    setFeShowSite(fe.show_site !== false);
    setFeShowAsset(fe.show_asset !== false);
    setFeShowCircuit(fe.show_circuit !== false);
  };

  const onAddFieldEngineer = async () => {
    if (!visitName.trim()) {
      setError("Field engineer name is required.");
      return;
    }
    if (deviceWasReplaced && !visitNewSerial.trim()) {
      setError("Enter New Device SR No. when hardware / software / device is replaced.");
      return;
    }
    setSavingVisit(true);
    setError(null);
    try {
      await updateServiceRequestTicket(ticketId, { field_engineer: saveVisitPayload() });
      const payload = {
        engineer_name: visitName.trim(),
        ...(visitEmail.trim() ? { engineer_email: visitEmail.trim() } : {}),
        engineer_contact: visitContact.trim() || undefined,
        assigned_date: visitDate || undefined,
        work_brief: feBrief.trim() || undefined,
        show_issue: feShowIssue,
        show_customer: feShowCustomer,
        show_site: feShowSite,
        show_asset: feShowAsset,
        show_circuit: feShowCircuit,
      };
      if (editingFeId) {
        await updateTicketFieldEngineer(ticketId, editingFeId, payload);
        resetFeForm();
        await load();
        return;
      }
      await addTicketFieldEngineer(ticketId, payload);
      resetFeForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save field engineer");
    } finally {
      setSavingVisit(false);
    }
  };

  const onMarkFeComplete = async (feId: string, feName: string) => {
    const summary = window.prompt(
      `Mark visit complete for ${feName}. Enter a short completion note:`,
      "On-site visit completed",
    );
    if (summary == null) return;
    if (!summary.trim()) {
      setError("Completion note is required.");
      return;
    }
    setError(null);
    try {
      await markFieldEngineerSolved(ticketId, feId, summary.trim());
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to mark FE visit complete");
    }
  };

  const openResolveDialog = () => {
    setResolveIssue(ticket?.issue_reported_code ?? "");
    setResolveResolution(ticket?.resolution_comment_code ?? "");
    setResolveRemarks(ticket?.other_remarks ?? "");
    setResolveNewSerial(ticket?.field_engineer?.new_device_serial ?? "");
    setResolveOpen(true);
  };

  const resolutionRequiresNewSerial = (code: string) =>
    code.startsWith("replaced_") || code.includes("replaced");

  const onResolve = async () => {
    if (resolving || !ticket) return;
    if (!resolveIssue.trim() || !resolveResolution.trim()) {
      setError("Select Issue Reported and Resolution Comment before resolving.");
      return;
    }
    if (resolveMissing.length > 0) {
      setError(`Cannot resolve yet: ${resolveMissing.join(", ")}.`);
      return;
    }
    if (resolutionRequiresNewSerial(resolveResolution) && !resolveNewSerial.trim()) {
      setError("Enter New Device SR No. for hardware / software / device replacement.");
      return;
    }
    setResolving(true);
    setError(null);
    try {
      if (resolutionRequiresNewSerial(resolveResolution)) {
        const baseFe = saveVisitPayload();
        await updateServiceRequestTicket(ticketId, {
          field_engineer: {
            ...baseFe,
            engineer_name: baseFe.engineer_name || ticket.field_engineer?.engineer_name || "Field Engineer",
            hardware_replacement_yn: "yes",
            new_device_serial: resolveNewSerial.trim(),
            hw_replacement:
              optionLabel(resolutionOptions, resolveResolution) || baseFe.hw_replacement || "Replaced",
          },
          serial_number: resolveNewSerial.trim(),
        });
      }
      const category = ticket.ticket_category ?? "";
      const solutionType = SOLUTION_TYPES.some((t) => t.value === category) ? category : "other";
      const remarks = resolveRemarks.trim();
      await resolveTicket(ticketId, {
        mode_of_action: ticket.mode_of_action ?? undefined,
        ticket_category: ticket.ticket_category ?? undefined,
        issue_reported_code: resolveIssue.trim(),
        resolution_comment_code: resolveResolution.trim(),
        other_remarks: remarks || null,
        solution_type: solutionType,
        solution_summary:
          remarks || optionLabel(resolutionOptions, resolveResolution) || optionLabel(issueOptions, resolveIssue) || "Resolved",
      });
      setResolveOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to resolve ticket");
    } finally {
      setResolving(false);
    }
  };

  const onCloseTicket = async (note: string) => {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      await closeTicket(ticketId, note ? { reason: note } : undefined);
      setCloseOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to close ticket");
      setCloseOpen(false);
    } finally {
      setClosing(false);
    }
  };

  const onRequestReopen = async (reason: string) => {
    if (reopenBusy) return;
    setReopenBusy(true);
    setError(null);
    try {
      await requestReopen(ticketId, reason);
      setReopenOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to request reopening");
      setReopenOpen(false);
    } finally {
      setReopenBusy(false);
    }
  };

  const onPauseSla = async (reason: string) => {
    if (slaBusy) return;
    setSlaBusy(true);
    setError(null);
    try {
      await pauseTicketSla(ticketId, reason);
      setSlaPauseOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to pause SLA");
      setSlaPauseOpen(false);
    } finally {
      setSlaBusy(false);
    }
  };

  const onResumeSla = async () => {
    if (slaBusy) return;
    setSlaBusy(true);
    setError(null);
    try {
      await resumeTicketSla(ticketId);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to resume SLA");
    } finally {
      setSlaBusy(false);
    }
  };

  const onApproveReopen = async () => {
    if (!pendingReopen || reopenBusy) return;
    setReopenBusy(true);
    setError(null);
    try {
      await approveReopenRequest(pendingReopen.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to approve reopen request");
    } finally {
      setReopenBusy(false);
    }
  };

  const onRejectReopen = async (reason: string) => {
    if (!pendingReopen || reopenBusy) return;
    setReopenBusy(true);
    setError(null);
    try {
      await rejectReopenRequest(pendingReopen.id, reason || undefined);
      setRejectOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reject reopen request");
      setRejectOpen(false);
    } finally {
      setReopenBusy(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canWork) return;
    if (file.size > 40 * 1024 * 1024) {
      setError("File exceeds 40MB limit");
      return;
    }
    await uploadTicketAttachment(ticketId, file);
    e.target.value = "";
    await load();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading ticket…</div>;
  if (stakeholderView) return <StakeholderStatusCard view={stakeholderView} />;
  if (error && !ticket) return <div className="text-destructive">{error}</div>;
  if (!ticket) return null;

  return (
    <div className="space-y-5">
      <ServicePageNoticeHost key={ticketId} notices={pageNotices} />

      <PageHeader
        title={ticket.subject}
        description={`${ticket.document_number} · ${ticketStatusLabel(ticket)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            {canWork ? (
              <Link
                href={`/service/service-request-tickets/${ticketId}/edit`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
              >
                <Edit className="size-3.5" />
                Edit
              </Link>
            ) : null}
            {canResolve ? (
              <Button type="button" size="sm" onClick={openResolveDialog}>
                Resolve
              </Button>
            ) : null}
            {canClose ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
                Close
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {resolveOpen ? (
        <ModalShell
          titleId="resolve-dialog-title"
          title="Resolve Ticket"
          description="Select Issue Reported and Resolution Comment, then confirm. Open FE visits are marked complete automatically."
          busy={resolving}
          onClose={() => setResolveOpen(false)}
        >
          <div className="mt-4 space-y-3">
            {issueOptions.length === 0 || resolutionOptions.length === 0 ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Issue/Resolution lists are still loading or empty. Refresh the page, then open Resolve again.
              </p>
            ) : null}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Issue Reported
              </label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={resolveIssue}
                onChange={(e) => setResolveIssue(e.target.value)}
                disabled={resolving}
              >
                <option value="">Select issue…</option>
                {issueOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Resolution Comment
              </label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={resolveResolution}
                onChange={(e) => setResolveResolution(e.target.value)}
                disabled={resolving}
              >
                <option value="">Select resolution…</option>
                {resolutionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {resolutionRequiresNewSerial(resolveResolution) ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  New Device SR No. <span className="text-destructive">*</span>
                </label>
                <Input
                  value={resolveNewSerial}
                  onChange={(e) => setResolveNewSerial(e.target.value)}
                  placeholder="Required when hardware / software / device is replaced"
                  disabled={resolving}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Other Remarks (optional)
              </label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Additional remarks…"
                value={resolveRemarks}
                onChange={(e) => setResolveRemarks(e.target.value)}
                disabled={resolving}
              />
            </div>
            {resolveMissing.length > 0 ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Required before resolving: {resolveMissing.join(", ")}.
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={resolving} onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                resolveMissing.length > 0 ||
                resolving ||
                (resolutionRequiresNewSerial(resolveResolution) && !resolveNewSerial.trim())
              }
              onClick={() => void onResolve()}
            >
              {resolving ? "Resolving…" : "Confirm — Resolve Ticket"}
            </Button>
          </div>
        </ModalShell>
      ) : null}

      {slaPauseOpen ? (
        <ReasonDialog
          titleId="sla-pause-dialog-title"
          title="Pause SLA"
          description="The SLA clock freezes until you resume it. A reason is required."
          label="Pause reason"
          placeholder="Why are you pausing the SLA?"
          confirmLabel="Pause SLA"
          busyLabel="Pausing…"
          required
          busy={slaBusy}
          onConfirm={(reason) => void onPauseSla(reason)}
          onClose={() => setSlaPauseOpen(false)}
        />
      ) : null}

      {closeOpen ? (
        <ReasonDialog
          titleId="close-dialog-title"
          title="Close Ticket"
          description="Closing finalises a resolved ticket. The API validates that all required details are present."
          label="Closing note (optional)"
          placeholder="Optional note…"
          confirmLabel="Confirm — Close Ticket"
          busyLabel="Closing…"
          busy={closing}
          onConfirm={(note) => void onCloseTicket(note)}
          onClose={() => setCloseOpen(false)}
        />
      ) : null}

      {reopenOpen ? (
        <ReasonDialog
          titleId="reopen-dialog-title"
          title="Request Reopening"
          description="An approver must approve this request before the ticket is reopened."
          label="Reason"
          placeholder="Why should this ticket be reopened?"
          confirmLabel="Submit Request"
          busyLabel="Submitting…"
          required
          busy={reopenBusy}
          onConfirm={(reason) => void onRequestReopen(reason)}
          onClose={() => setReopenOpen(false)}
        />
      ) : null}

      {rejectOpen ? (
        <ReasonDialog
          titleId="reject-reopen-dialog-title"
          title="Reject Reopen Request"
          label="Reason"
          placeholder="Why is the request being rejected?"
          confirmLabel="Reject Request"
          busyLabel="Rejecting…"
          required
          busy={reopenBusy}
          onConfirm={(reason) => void onRejectReopen(reason)}
          onClose={() => setRejectOpen(false)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
        <span className="mr-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</span>
        <FinanceStatusBadge status={ticket.priority} />
        <FinanceStatusBadge status={ticket.status} label={ticket.status_label} />
        {ticket.mode_of_action ? <FinanceStatusBadge status={ticket.mode_of_action} /> : null}
        {ticket.sla_breached ? <FinanceStatusBadge status="overdue" label="SLA breached" /> : null}
        {pendingReopen ? <FinanceStatusBadge status="pending" label="Reopen requested" /> : null}
        {access?.is_owner ? <FinanceStatusBadge status="owner" /> : null}
        {access?.is_co_owner ? <FinanceStatusBadge status="co_owner" /> : null}
      </div>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <SectionCard title="Basic Information">
            <DetailGrid>
              <DetailRow label="Contact Name" value={ticket.contact_name} />
              <DetailRow label="Email" value={ticket.email} />
              <DetailRow label="Mobile" value={ticket.mobile} />
              <DetailRow label="Channel" value={ticket.channel} />
              {canChooseMode ? (
                <DetailSelect
                  label="Resolution Mode"
                  value={ticket.mode_of_action ?? ""}
                  options={modeOptions}
                  placeholder="Select resolution mode…"
                  onChange={(value) => void patchTicketField("mode_of_action", value || null, "Failed to set resolution mode")}
                />
              ) : (
                <DetailRow
                  label="Resolution Mode"
                  value={
                    ticket.mode_of_action
                      ? formatStatus(ticket.mode_of_action)
                      : canOpen
                        ? "Choose after opening ticket"
                        : isOpened
                          ? "Select resolution mode…"
                          : "Not set yet"
                  }
                />
              )}
              <DetailRow label="Priority" value={ticket.priority.toUpperCase()} />
              {canChooseCategory ? (
                <DetailSelect
                  label="Category"
                  value={ticket.ticket_category ?? ""}
                  options={categoryOptions}
                  placeholder="Select category…"
                  onChange={(value) =>
                    void updateServiceRequestTicket(ticketId, { ticket_category: value || null })
                      .then(load)
                      .catch((err) =>
                        setError(err instanceof ApiClientError ? err.message : "Failed to set category"),
                      )
                  }
                />
              ) : (
                <DetailRow
                  label="Category"
                  value={
                    ticket.ticket_category
                      ? formatStatus(ticket.ticket_category)
                      : canOpen
                        ? "Choose after opening ticket"
                        : isOpened
                          ? "Select category…"
                          : "Not set yet"
                  }
                />
              )}
              <DetailRow
                label="Ticket Start"
                value={(ticket.ticket_start_at || ticket.sla_started_at || ticket.created_at)?.slice(0, 16)}
              />
              <DetailRow
                label="Ticket End"
                value={(ticket.ticket_end_at || ticket.closed_at || ticket.resolved_at)?.slice(0, 16) || "Open"}
              />
              {canEditResolutionFields ? (
                <DetailInput
                  label="Present Type"
                  value={ticket.present_type}
                  placeholder="From mail — present type"
                  manual={Boolean(ticket.field_manual_overrides?.present_type)}
                  onCommit={(value) => void patchExtractedField("present_type", value, "Failed to save present type")}
                />
              ) : (
                <DetailRow label="Present Type" value={ticket.present_type} emptyText="NA" />
              )}
            </DetailGrid>
          </SectionCard>

          <SectionCard title="SLA">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {slaIsPaused ? <FinanceStatusBadge status="pending" label="SLA paused" /> : null}
              {ticket.sla_breached ? <FinanceStatusBadge status="overdue" label="SLA breached" /> : null}
              {canPauseSla ? (
                <Button type="button" size="sm" variant="outline" disabled={slaBusy} onClick={() => setSlaPauseOpen(true)}>
                  Pause SLA
                </Button>
              ) : null}
              {canResumeSla ? (
                <Button type="button" size="sm" disabled={slaBusy} onClick={() => void onResumeSla()}>
                  {slaBusy ? "Resuming…" : "Resume SLA"}
                </Button>
              ) : null}
            </div>
            <DetailGrid>
              <DetailRow
                label="SLA Status"
                value={
                  slaIsPaused
                    ? "Paused"
                    : ticket.sla_status ?? (ticket.sla_started_at ? "within_sla" : "Not started")
                }
              />
              {ticket.sla_started_at ? (
                <DetailRow label="SLA Started" value={ticket.sla_started_at.slice(0, 16).replace("T", " ")} />
              ) : (
                <DetailRow label="SLA Clock" value="Starts on ticket create / email receipt" />
              )}
              {ticket.due_at ? (
                <DetailRow label="SLA Due" value={ticket.due_at.slice(0, 16).replace("T", " ")} />
              ) : null}
              {ticket.sla_paused_at ? (
                <DetailRow label="Paused At" value={ticket.sla_paused_at.slice(0, 16).replace("T", " ")} />
              ) : null}
              {ticket.sla_target_minutes != null ? (
                <DetailRow label="SLA Target" value={formatDurationMinutes(ticket.sla_target_minutes)} />
              ) : null}
              {ticket.sla_elapsed_minutes != null ? (
                <DetailRow label="SLA Elapsed" value={formatDurationMinutes(ticket.sla_elapsed_minutes)} />
              ) : null}
              {ticket.sla_remaining_minutes != null ? (
                <DetailRow
                  label={ticket.sla_remaining_minutes < 0 ? "SLA Overdue By" : "SLA Remaining"}
                  value={formatDurationMinutes(Math.abs(ticket.sla_remaining_minutes))}
                />
              ) : null}
              {(ticket.sla_paused_total_minutes ?? 0) > 0 || slaIsPaused ? (
                <DetailRow
                  label="Total Paused"
                  value={formatDurationMinutes(ticket.sla_paused_total_minutes ?? 0)}
                />
              ) : null}
              {ticket.sla_breached != null ? (
                <DetailRow label="SLA Breach" value={ticket.sla_breached ? "Breached" : "Not breached"} />
              ) : null}
              {ticket.sla_policy_snapshot && typeof ticket.sla_policy_snapshot === "object" ? (
                <DetailRow
                  label="SLA Policy"
                  value={
                    typeof ticket.sla_policy_snapshot.duration_minutes === "number"
                      ? `${formatDurationMinutes(ticket.sla_policy_snapshot.duration_minutes as number)} (${
                          String(ticket.sla_policy_snapshot.priority ?? ticket.priority).toUpperCase()
                        })`
                      : JSON.stringify(ticket.sla_policy_snapshot)
                  }
                  emptyText="NA"
                />
              ) : null}
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Issue Description">
            <ProseBlock>{ticket.issue_description || ticket.description || "—"}</ProseBlock>
          </SectionCard>

          <SectionCard title="Issue & Resolution">
            {canEditResolutionFields ? (
              <DetailGrid>
                <DetailSelect
                  label="Issue Reported"
                  value={ticket.issue_reported_code ?? ""}
                  options={issueOptions}
                  placeholder="Select issue reported…"
                  onChange={(value) =>
                    void patchTicketField("issue_reported_code", value || null, "Failed to save issue reported")
                  }
                />
                <DetailSelect
                  label="Resolution Comment"
                  value={ticket.resolution_comment_code ?? ""}
                  options={resolutionOptions}
                  placeholder="Select resolution comment…"
                  onChange={(value) =>
                    void patchTicketField("resolution_comment_code", value || null, "Failed to save resolution comment")
                  }
                />
                <DetailTextarea
                  label="Other Remarks"
                  value={ticket.other_remarks}
                  placeholder="Optional remarks…"
                  onCommit={(value) => void patchTicketField("other_remarks", value, "Failed to save remarks")}
                />
              </DetailGrid>
            ) : (
              <DetailGrid>
                <DetailRow
                  label="Issue Reported"
                  value={optionLabel(issueOptions, ticket.issue_reported_code)}
                  emptyText="NA"
                />
                <DetailRow
                  label="Resolution Comment"
                  value={optionLabel(resolutionOptions, ticket.resolution_comment_code)}
                  emptyText="NA"
                />
                <div className="sm:col-span-2">
                  <DetailRow label="Other Remarks" value={ticket.other_remarks} emptyText="NA" />
                </div>
              </DetailGrid>
            )}
          </SectionCard>

          {(ticket.reference_sr_number ||
            ticket.ckt_id ||
            ticket.lsi ||
            ticket.company_name_from_mail ||
            ticket.end_customer_name ||
            ticket.site_availability ||
            ticket.link_type ||
            ticket.bandwidth ||
            ticket.previous_fe_notes) ? (
            <SectionCard title="Circuit / Site (from email)">
              <DetailGrid>
                {canEditResolutionFields ? (
                  <>
                    <DetailInput
                      label="SR Number"
                      value={ticket.reference_sr_number}
                      manual={Boolean(ticket.field_manual_overrides?.reference_sr_number)}
                      onCommit={(value) =>
                        void patchExtractedField("reference_sr_number", value, "Failed to save SR number")
                      }
                    />
                    <DetailInput
                      label="CKT ID"
                      value={ticket.ckt_id || ticket.lsi}
                      manual={Boolean(ticket.field_manual_overrides?.ckt_id || ticket.field_manual_overrides?.lsi)}
                      onCommit={(value) => void patchExtractedField("ckt_id", value, "Failed to save CKT ID")}
                    />
                  </>
                ) : (
                  <>
                    <DetailRow label="SR Number" value={ticket.reference_sr_number} emptyText="NA" />
                    <DetailRow label="CKT ID" value={ticket.ckt_id || ticket.lsi} emptyText="NA" />
                  </>
                )}
                <DetailRow
                  label="Company (mail)"
                  value={ticket.company_name_from_mail || ticket.customer_reference}
                  emptyText="NA"
                />
                <DetailRow label="End Customer" value={ticket.end_customer_name} emptyText="NA" />
                <DetailRow label="LC / Coordinator Phone" value={ticket.coordinator_phone} emptyText="NA" />
                <DetailRow label="Site Availability" value={ticket.site_availability} emptyText="NA" />
                <DetailRow label="Link Type" value={ticket.link_type} emptyText="NA" />
                <DetailRow label="Bandwidth" value={ticket.bandwidth} emptyText="NA" />
                <DetailRow label="Address" value={ticket.end_customer_street} emptyText="NA" />
                <DetailRow
                  label="City / State"
                  value={[ticket.end_customer_city, ticket.end_customer_state].filter(Boolean).join(", ") || null}
                  emptyText="NA"
                />
                <DetailRow label="PIN" value={ticket.end_customer_postal_code} emptyText="NA" />
              </DetailGrid>
              {ticket.previous_fe_notes ? (
                <div className="mt-3 space-y-1">
                  <p className={detailLabelCls}>Previous Ticket</p>
                  <ProseBlock>{ticket.previous_fe_notes}</ProseBlock>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

              <SectionCard title="Asset Details">
                {canWork && !ticketEnded && !assetConfirmed ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Values below come from the inbound email when available. Correct anything missing or wrong, then confirm.
                    </p>
                    <DetailGrid>
                      <DetailInput
                        label="Asset Name"
                        value={ticket.asset_name}
                        placeholder="From mail — model / asset name"
                        manual={Boolean(ticket.field_manual_overrides?.asset_name)}
                        onCommit={(value) =>
                          void patchExtractedField("asset_name", value, "Failed to save asset name")
                        }
                      />
                      <DetailSelect
                        label="Device"
                        value={ticket.asset_status ?? ""}
                        options={[
                          { value: "new_asset", label: "New Device" },
                          { value: "existing_asset", label: "Existing Device" },
                        ]}
                        placeholder="Select device type…"
                        onChange={(value) =>
                          void patchExtractedField("asset_status", value || null, "Failed to save device type")
                        }
                      />
                      <DetailInput
                        label="Serial Number"
                        value={ticket.serial_number}
                        placeholder="From mail — device serial"
                        manual={Boolean(ticket.field_manual_overrides?.serial_number)}
                        onCommit={(value) =>
                          void patchExtractedField("serial_number", value, "Failed to save serial number")
                        }
                      />
                      <DetailInput
                        label="Warranty Start"
                        value={ticket.warranty_start_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void patchExtractedField("warranty_start_date", value, "Failed to save warranty start")
                        }
                      />
                      <DetailInput
                        label="Warranty End"
                        value={ticket.warranty_end_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void patchExtractedField("warranty_end_date", value, "Failed to save warranty end")
                        }
                      />
                      <DetailInput
                        label="AMC End"
                        value={ticket.amc_end_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void patchExtractedField("amc_end_date", value, "Failed to save AMC end")
                        }
                      />
                    </DetailGrid>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void onConfirmAsset()}
                    >
                      Confirm asset details
                    </Button>
                  </div>
                ) : (
                  <DetailGrid>
                  <DetailRow label="Asset Name" value={ticket.asset_name} />
                    <DetailRow
                      label="Device"
                      value={
                        ticket.asset_status === "new_asset"
                          ? "New Device"
                          : ticket.asset_status === "existing_asset"
                            ? "Existing Device"
                            : ticket.asset_status
                      }
                    />
                  <DetailRow label="Serial Number" value={ticket.serial_number} />
                  <DetailRow label="Warranty Start" value={ticket.warranty_start_date?.slice(0, 10)} />
                  <DetailRow label="Warranty End" value={ticket.warranty_end_date?.slice(0, 10)} />
                  <DetailRow label="AMC End" value={ticket.amc_end_date?.slice(0, 10)} />
                  {assetConfirmed ? (
                    <DetailRow
                      label="Asset Confirmed"
                      value={ticket.asset_confirmed_at?.slice(0, 16).replace("T", " ") ?? "Yes"}
                    />
                  ) : null}
                  </DetailGrid>
                )}
              </SectionCard>

          {showVisitSection ? (
                <SectionCard title="Field Engineer Visit">
              {canEditVisitPlan ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Field Engineer Name">
                      <Input value={visitName} onChange={(e) => setVisitName(e.target.value)} />
                    </FormField>
                    <FormField label="Contact Number">
                      <Input value={visitContact} onChange={(e) => setVisitContact(e.target.value)} />
                    </FormField>
                    <FormField label="Engineer Carrying spares tools">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={visitCarrying}
                        onChange={(e) => setVisitCarrying(e.target.value)}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </FormField>
                    <FormField label="Site Visit Date">
                      <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                    </FormField>
                    <FormField label="Hardware Repair">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={visitHwRepair}
                        onChange={(e) => setVisitHwRepair(e.target.value)}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </FormField>
                    <FormField label="Replaced (Hardware / Software / Device)">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={visitHwReplacement}
                        onChange={(e) => setVisitHwReplacement(e.target.value)}
                      >
                        <option value="false">No</option>
                        <option value="hardware">Hardware replaced</option>
                        <option value="software">Software replaced</option>
                        <option value="device">Device replaced</option>
                      </select>
                    </FormField>
                    {deviceWasReplaced ? (
                      <>
                        <FormField label="New Device SR No." required>
                          <Input
                            value={visitNewSerial}
                            onChange={(e) => setVisitNewSerial(e.target.value)}
                            placeholder="Required for replacement"
                            required
                          />
                        </FormField>
                        <FormField label="Replacement Details">
                          <Input
                            placeholder="-None-"
                            value={visitHw}
                            onChange={(e) => setVisitHw(e.target.value)}
                          />
                        </FormField>
                      </>
                    ) : null}
                    <FormField label="Mode of Transport">
                      <Input value={visitTransport} onChange={(e) => setVisitTransport(e.target.value)} />
                    </FormField>
                    <FormField label="Movement Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitMovement}
                        onChange={(e) => setVisitMovement(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Visit Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitChargesAmt}
                        onChange={(e) => setVisitChargesAmt(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Other Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitOtherCharges}
                        onChange={(e) => setVisitOtherCharges(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Total Charges (Visit + Movement + Other)">
                      <Input
                        readOnly
                        value={visitTotalComputed != null ? formatInr(visitTotalComputed) : ""}
                        placeholder="—"
                      />
                    </FormField>
                    <div className="sm:col-span-2">
                      <FormField label="Remarks">
                        <textarea
                          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={visitRemarks}
                          onChange={(e) => setVisitRemarks(e.target.value)}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingVisit || !visitName.trim()}
                      onClick={() => void onUpdateVisitDetails()}
                    >
                      {savingVisit ? "Saving…" : "Save visit details"}
                    </Button>
                  </div>

                  {hasFieldEngineers ? (
                    <div className="mt-5 border-t border-border/60 pt-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Assigned field engineers
                      </p>
                      <ul className="space-y-2 text-sm">
                        {fieldEngineers.map((fe) => (
                          <li key={fe.id} className="rounded-md border border-border/60 bg-background px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm">{fe.engineer_name}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {fe.engineer_contact || "—"} · {fe.engineer_email}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                    {fe.assigned_date?.slice(0, 10) || "No date"}
                                  </span>
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                    {formatStatus(fe.status)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col gap-1">
                                {fe.status !== "solved" ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void onMarkFeComplete(fe.id, fe.engineer_name)}
                                  >
                                    Mark complete
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void removeTicketFieldEngineer(ticketId, fe.id).then(load)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {hasFieldEngineers ? (
                    <div className="mb-4 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Assigned field engineers
                      </p>
                      <ul className="space-y-2 text-sm">
                        {fieldEngineers.map((fe) => (
                          <li key={fe.id} className="rounded-md border border-border/60 bg-background px-3 py-2.5">
                            <div className="font-medium">{fe.engineer_name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {[fe.engineer_contact, fe.engineer_email].filter(Boolean).join(" · ") || "—"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {fe.assigned_date?.slice(0, 10) || "No date"}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {fe.status === "solved" ? "Completed" : formatStatus(fe.status)}
                              </span>
                            </div>
                            {fe.work_brief ? (
                              <p className="mt-2 text-xs text-muted-foreground">{fe.work_brief}</p>
                            ) : null}
                            {fe.solution_summary ? (
                              <p className="mt-1 text-xs">{fe.solution_summary}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <DetailGrid>
                    <DetailRow label="Field Engineer Name" value={ticket?.field_engineer?.engineer_name} />
                    <DetailRow label="Contact Number" value={ticket?.field_engineer?.engineer_contact} />
                    <DetailRow
                      label="Engineer Carrying spares tools"
                      value={ticket?.field_engineer?.carrying_spares ? "Yes" : "No"}
                    />
                    <DetailRow
                      label="Site Visit Date"
                      value={ticket?.field_engineer?.visit_date?.slice(0, 10) ?? null}
                    />
                    <DetailRow
                      label="Hardware Repair"
                      value={yesNoFromApi(ticket?.field_engineer?.hardware_repair) ? "Yes" : "No"}
                    />
                    <DetailRow
                      label="Replaced (Hardware / Software / Device)"
                      value={
                        yesNoFromApi(ticket?.field_engineer?.hardware_replacement) ||
                        ticket?.field_engineer?.hardware_replacement_yn?.toLowerCase() === "yes"
                          ? ticket?.field_engineer?.hw_replacement || "Yes"
                          : "No"
                      }
                    />
                    {yesNoFromApi(ticket?.field_engineer?.hardware_replacement) ||
                    ticket?.field_engineer?.hardware_replacement_yn?.toLowerCase() === "yes" ? (
                      <DetailRow
                        label="New Device SR No."
                        value={ticket.field_engineer.new_device_serial}
                        emptyText="Required"
                      />
                    ) : null}
                    <DetailRow label="Mode of Transport" value={ticket?.field_engineer?.transport_mode} />
                    <DetailRow
                      label="Movement Charges"
                      value={
                        ticket?.field_engineer?.movement_charges != null
                          ? formatInr(ticket.field_engineer.movement_charges)
                          : null
                      }
                    />
                    <DetailRow
                      label="Visit Charges"
                      value={
                        ticket?.field_engineer?.visit_charges != null
                          ? formatInr(ticket.field_engineer.visit_charges)
                          : null
                      }
                    />
                    <DetailRow
                      label="Other Charges"
                      value={
                        ticket?.field_engineer?.other_charges != null
                          ? formatInr(ticket.field_engineer.other_charges)
                          : null
                      }
                    />
                    <DetailRow
                      label="Total Charges"
                      value={
                        ticket?.field_engineer?.total_charges != null
                          ? formatInr(ticket.field_engineer.total_charges)
                          : null
                      }
                    />
                    {ticket?.field_engineer?.remarks ? (
                      <div className="sm:col-span-2">
                        <DetailRow label="Remarks" value={ticket.field_engineer.remarks} />
                      </div>
                    ) : null}
                  </DetailGrid>
                </>
              )}
                </SectionCard>
              ) : null}

          {canWork || ticketEnded ? (
            <>
              {isOemMode || (ticket.oem_support_enabled && ticket.oem_support) ? (
                <SectionCard title="OEM Support">
                  <p className="mb-3 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    OEM workflow is a placeholder and will be configured later. Details below are for reference only.
                  </p>
                  <DetailGrid>
                    <DetailRow label="OEM Name" value={ticket.oem_support?.oem_name} />
                    <DetailRow label="OEM Ticket #" value={ticket.oem_support?.oem_ticket_number} />
                    <DetailRow label="Ticket Type" value={ticket.oem_support?.ticket_type} />
                    <DetailRow label="OEM Status" value={ticket.oem_support?.oem_status} />
                    <DetailRow label="TAC Summary" value={ticket.oem_support?.tac_response_summary} />
                    <DetailRow label="TAC Resolution" value={ticket.oem_support?.tac_resolution} />
                  </DetailGrid>
                </SectionCard>
              ) : null}
            </>
          ) : null}
                </div>

        <div className="min-w-0 space-y-4">
          {(canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <SectionCard title="Ticket Timeline">
              <TicketTimelinePanel
                items={timeline}
                onExport={() =>
                  void exportTicketTimelineXlsx(ticketId).catch((err) =>
                    setError(err instanceof ApiClientError ? err.message : "Timeline export failed"),
                  )
                }
              />
            </SectionCard>
          ) : null}

          {(canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <SectionCard title="SLA History">
              <SlaHistoryTimeline
                pauses={slaPauses}
                emptyText="No SLA pause / unpause history on this ticket yet."
                maxHeightClassName="max-h-80"
              />
            </SectionCard>
          ) : null}

          {(canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <SectionCard title="Previous Ticket History">
              {!circuitKey ? (
                <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                  Set a CKT ID to see earlier tickets on the same circuit.
                </p>
              ) : circuitHistoryLoading && !circuitHistory ? (
                <p className="text-sm text-muted-foreground">Loading history for CKT {circuitKey}…</p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs">
                      <span className="font-bold tracking-wide text-foreground/80 uppercase">CKT ID</span>
                      <span className="font-bold text-foreground">
                        {circuitHistory?.ckt_id || circuitKey.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs">
                      <span className="font-bold tracking-wide text-foreground/80 uppercase">Prior</span>
                      <span className="font-bold text-foreground">{circuitHistory?.count ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs">
                      <span className="font-bold tracking-wide text-foreground/80 uppercase">Last</span>
                      <span className="font-semibold text-foreground">
                        {circuitHistory?.last_ticket_at
                          ? circuitHistory.last_ticket_at.slice(0, 16).replace("T", " ")
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {(circuitHistory?.items.length ?? 0) === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                      No previous tickets found for this CKT ID.
                    </p>
                  ) : (
                    <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {(circuitHistory?.items ?? []).map((row) => (
                        <li
                          key={row.id}
                          className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/service/service-request-tickets/${row.id}`}
                              className="font-mono text-xs font-bold text-primary hover:underline"
                            >
                              {row.document_number}
                            </Link>
                            <FinanceStatusBadge status={row.status} label={row.status_label ?? undefined} />
                          </div>
                          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                            <span className="font-semibold text-foreground/80">
                              {row.created_at?.slice(0, 16).replace("T", " ") ?? "—"}
                            </span>
                          </p>
                          {row.subject ? (
                            <p className="mt-1 break-words text-xs font-semibold text-foreground [overflow-wrap:anywhere]">
                              {row.subject}
                            </p>
                          ) : null}
                          <dl className="mt-2 space-y-1">
                            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs">
                              <dt className="font-bold tracking-wide text-foreground/80">Issue</dt>
                              <dd className="min-w-0 break-words font-semibold">
                                {row.issue_reported ??
                                  optionLabel(issueOptions, row.issue_reported_code) ??
                                  "—"}
                              </dd>
                            </div>
                            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs">
                              <dt className="font-bold tracking-wide text-foreground/80">Resolution</dt>
                              <dd className="min-w-0 break-words font-semibold">
                                {row.resolution_comment ??
                                  optionLabel(resolutionOptions, row.resolution_comment_code) ??
                                  "—"}
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </SectionCard>
          ) : null}

          {(ticketEnded || ticket.solution_summary) ? (
            <SectionCard title="Service Engineer Solution">
              {ticket.solution_summary ? (
                <div className="space-y-3">
                  <DetailGrid>
                    <DetailRow
                      label="Type"
                      value={ticket.solution_type ? formatStatus(ticket.solution_type) : null}
                    />
                    <DetailRow label="Resolved" value={ticket.resolved_at?.slice(0, 16)?.replace("T", " ")} />
                    {ticket.closed_at ? (
                      <DetailRow label="Closed" value={ticket.closed_at.slice(0, 16).replace("T", " ")} />
                    ) : null}
                  </DetailGrid>
                  <div>
                    <p className={cn("mb-1.5", detailLabelCls)}>Summary</p>
                    <ProseBlock>{ticket.solution_summary}</ProseBlock>
        </div>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
                  Ticket ended — no solution summary recorded.
                </p>
              )}
            </SectionCard>
          ) : null}

          {(canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <TicketAttachmentsCard
              attachments={attachments}
              ticketId={ticketId}
              fieldEngineers={fieldEngineers}
              canUpload={canWork && !ticketEnded}
              onUpload={(e) => void onUpload(e)}
              onDelete={(id) => void deleteTicketAttachment(ticketId, id).then(load)}
            />
          ) : null}

          {(ticketEnded || showFieldEngineers || hasFieldEngineers) &&
          (canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <FieldEngineerStatusCard fieldEngineers={fieldEngineers} ticketId={ticketId} />
          ) : null}

          {canOpen ? (
            <SectionCard title="Open Ticket">
              <p className="mb-3 text-sm text-muted-foreground">
                This ticket is assigned to you. Open it to begin work, then choose Resolution Mode and Category in Basic Information. Resolution Mode can be changed until the ticket is resolved.
              </p>
              <Button type="button" className="w-full" onClick={() => void onOpenTicket()}>
                Open Ticket (Start Work)
              </Button>
            </SectionCard>
          ) : null}

          {(canAssign && (isPreview || access?.can_assign)) ? (
            <SectionCard title="Assign Owner">
              <p className="mb-2 text-xs text-muted-foreground">
                Assign a specific person to own and work this ticket.
              </p>
              <select
                className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={assignOwnerId}
                onChange={(e) => setAssignOwnerId(e.target.value)}
              >
                <option value="">Select engineer…</option>
                {employees.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" className="w-full" disabled={!assignOwnerId} onClick={() => void onAssign()}>
                <UserPlus className="size-3.5" />
                Assign
              </Button>
            </SectionCard>
          ) : null}

          {canManage ? (
            <SectionCard title="Co-Owners">
              <p className="mb-2 text-xs text-muted-foreground">
                Co-owners can work on this ticket alongside you.
              </p>
              <select
                className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={coOwnerId}
                onChange={(e) => setCoOwnerId(e.target.value)}
              >
                <option value="">Add co-owner…</option>
                {employees
                  .filter((e) => e.value !== ticket.owner_employee_id)
                  .map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
              </select>
              <Button type="button" size="sm" variant="outline" className="mb-3 w-full" disabled={!coOwnerId} onClick={() => void onAddCoOwner()}>
                <Users className="size-3.5" />
                Add Co-Owner
              </Button>
              <ul className="space-y-1 text-sm">
                {(ticket.co_owners ?? []).length === 0 ? (
                  <li className="text-muted-foreground">No co-owners yet.</li>
                ) : (
                  ticket.co_owners?.map((c) => {
                    const label = employees.find((e) => e.value === c.employee_id)?.label ?? c.employee_id.slice(0, 8);
                    return (
                      <li key={c.id} className="flex items-center justify-between rounded border border-border/50 px-2 py-1">
                        <span>{label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void removeTicketCoOwner(ticketId, c.employee_id).then(load)}
                        >
                          Remove
                        </Button>
                      </li>
                    );
                  })
                )}
              </ul>
            </SectionCard>
          ) : null}

          {assignmentHistory.length > 0 ? (
            <SectionCard title="Assignment History">
              <ul className="max-h-60 space-y-2 overflow-y-auto pr-0.5">
                {assignmentHistory.map((item) => (
                  <li key={item.id} className="min-w-0 rounded-md border border-border/50 bg-background px-3 py-2.5">
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {(item.changed_at ?? item.assigned_at)?.slice(0, 16).replace("T", " ") ?? "—"}
                    </p>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                      {(item.old_owner_name ?? item.from_employee_name)
                        ? `${item.old_owner_name ?? item.from_employee_name} → `
                        : ""}
                      {item.new_owner_name ??
                        item.to_employee_name ??
                        employees.find((e) => e.value === item.new_owner_employee_id)?.label ??
                        "Unassigned"}
                    </p>
                    {item.reason ? (
                      <p className="mt-1 break-words text-xs leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
                        {item.reason}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {pendingReopen ? (
            <SectionCard title="Reopen Request">
              <div className="space-y-3">
                <DetailGrid>
                  <DetailRow label="Status" value={formatStatus(pendingReopen.status)} />
                  <DetailRow
                    label="Requested"
                    value={pendingReopen.requested_at?.slice(0, 16).replace("T", " ") ?? null}
                  />
                  <DetailRow label="Requested By" value={pendingReopen.requested_by_name} emptyText="NA" />
                </DetailGrid>
                <ProseBlock>{pendingReopen.reason || "No reason provided."}</ProseBlock>
                {canApproveReopen ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="flex-1" disabled={reopenBusy} onClick={() => void onApproveReopen()}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={reopenBusy}
                      onClick={() => setRejectOpen(true)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Awaiting approval from a service approver.</p>
                )}
              </div>
            </SectionCard>
          ) : null}

          {lastReopenDecision ? (
            <SectionCard title="Last Reopen Request">
              <DetailGrid>
                <DetailRow label="Status" value={formatStatus(lastReopenDecision.status)} />
                <DetailRow
                  label="Decided"
                  value={lastReopenDecision.decided_at?.slice(0, 16).replace("T", " ") ?? null}
                />
              </DetailGrid>
              {lastReopenDecision.decision_reason ? (
                <div className="mt-3">
                  <ProseBlock>{lastReopenDecision.decision_reason}</ProseBlock>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {canRequestReopen ? (
            <SectionCard title="Reopen">
              <p className="mb-2 text-xs text-muted-foreground">
                Reopening needs approval. Ownership stays with the current owner and co-owners are preserved.
              </p>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setReopenOpen(true)}>
                Request Reopening
              </Button>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
