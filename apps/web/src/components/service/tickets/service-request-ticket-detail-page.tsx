"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Edit, Paperclip, RefreshCw, UserPlus, Users } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ServicePageNoticeHost } from "@/components/service/service-page-notice";
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
  assignTicketOwner,
  attachmentDownloadUrl,
  deleteTicketAttachment,
  exportTicketTimelineXlsx,
  formatStatus,
  getServiceRequestTicket,
  getTicketStakeholderView,
  getTicketTimeline,
  issueTicketFieldEngineerCredentials,
  listAssignableEmployees,
  listTicketAttachments,
  loadTicketFormLookups,
  openTicket,
  removeTicketCoOwner,
  removeTicketFieldEngineer,
  reopenTicket,
  resolveTicket,
  updateServiceRequestTicket,
  updateTicketFieldEngineer,
  SOLUTION_TYPES,
  type LookupOption,
  type ServiceRequestTicket,
  type TicketAttachment,
  type TicketFieldEngineer,
  type TicketStakeholderView,
  type TimelineItem,
  uploadTicketAttachment,
} from "@/services/service-request-ticket-service";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const display = value?.trim() ? formatServiceDisplayText(value) : "—";
  const empty = !value?.trim();
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/80 px-3 py-2.5">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={`mt-1 max-w-full break-words text-sm leading-snug [overflow-wrap:anywhere] ${
          empty ? "text-muted-foreground/70" : "font-medium text-foreground"
        }`}
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
    <div className="min-w-0 rounded-md border border-border/50 bg-background/80 px-3 py-2.5">
      <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</label>
      <select
        className="mt-1.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
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

function DetailInput({
  label,
  value,
  type = "text",
  placeholder,
  onCommit,
}: {
  label: string;
  value?: string | null;
  type?: string;
  placeholder?: string;
  onCommit: (value: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/80 px-3 py-2.5">
      <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</label>
      <input
        type={type}
        className="mt-1.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground"
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

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid min-w-0 gap-2 sm:grid-cols-2">{children}</dl>;
}

function ProseBlock({ children }: { children: ReactNode }) {
  const content =
    typeof children === "string" || typeof children === "number"
      ? formatServiceDisplayText(String(children))
      : children;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-border/50 bg-muted/25 px-3.5 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground">
      {content}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/35 px-4 py-2.5">
        <h2 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">{title}</h2>
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
                {fe.status === "solved" ? "Solved" : formatStatus(fe.status)}
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
                        <a
                          href={attachmentDownloadUrl(ticketId, a.id)}
                          className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Paperclip className="size-3 shrink-0" />
                          <span className="truncate">{a.file_name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {fe.work_brief ? "Brief sent — awaiting FE submission." : "Awaiting field engineer work."}
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
                  <a
                    href={attachmentDownloadUrl(ticketId, a.id)}
                    className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Paperclip className="size-3.5 shrink-0" />
                    <span className="truncate">{a.file_name}</span>
                  </a>
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
  const [feCredsNotice, setFeCredsNotice] = useState<{
    email: string;
    password?: string | null;
    note?: string | null;
    emailed: boolean;
    created: boolean;
  } | null>(null);
  const [visitName, setVisitName] = useState("");
  const [visitContact, setVisitContact] = useState("");
  const [visitDistance, setVisitDistance] = useState("");
  const [visitVisits, setVisitVisits] = useState("");
  const [visitCarrying, setVisitCarrying] = useState("false");
  const [visitDate, setVisitDate] = useState("");
  const [visitHw, setVisitHw] = useState("");
  const [visitTransport, setVisitTransport] = useState("");
  const [visitMovement, setVisitMovement] = useState("");
  const [visitChargesAmt, setVisitChargesAmt] = useState("");
  const [visitTotal, setVisitTotal] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [visitEmail, setVisitEmail] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [modeOptions, setModeOptions] = useState<LookupOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<LookupOption[]>([]);
  const [solutionType, setSolutionType] = useState("installation");
  const [solutionSummary, setSolutionSummary] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canAssign, setCanAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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

      try {
        const t = await getServiceRequestTicket(ticketId);
        setTicket(t);
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fe = ticket?.field_engineer;
    setVisitName(fe?.engineer_name ?? "");
    setVisitContact(fe?.engineer_contact ?? "");
    setVisitDistance(fe?.distance ?? "");
    setVisitVisits(fe?.visits_count != null ? String(fe.visits_count) : "");
    setVisitCarrying(fe?.carrying_spares ? "true" : "false");
    setVisitDate(fe?.visit_date?.slice(0, 10) ?? "");
    setVisitHw(fe?.hw_replacement ?? "");
    setVisitTransport(fe?.transport_mode ?? "");
    setVisitMovement(fe?.movement_charges != null ? String(fe.movement_charges) : "");
    setVisitChargesAmt(fe?.visit_charges != null ? String(fe.visit_charges) : "");
    setVisitTotal(fe?.total_charges != null ? String(fe.total_charges) : "");
    setVisitRemarks(fe?.remarks ?? "");
  }, [ticket?.id, ticket?.field_engineer]);

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
  const canChooseMode = canWork && isOpened && !modeFixed;
  const canChooseCategory = canWork && isOpened && !categoryFixed;
  const needsSupportChoice = canWork && isOpened && !supportChosen;
  const showFieldEngineers =
    supportChosen &&
    (ticket?.mode_of_action === "onsite_support" || ticket?.mode_of_action === "oem_support");
  const ticketEnded = ticket?.status === "closed" || ticket?.status === "resolved";
  const fieldEngineers = ticket?.field_engineers ?? [];
  const hasFieldEngineers = fieldEngineers.length > 0;
  const assetConfirmed = Boolean(ticket?.asset_confirmed_at);
  const needsAssetConfirm = canWork && isOpened && !ticketEnded && !assetConfirmed;
  const canEditVisitPlan = canWork && showFieldEngineers && !ticketEnded && assetConfirmed;
  const showVisitSection = showFieldEngineers && (canEditVisitPlan || Boolean(ticket?.field_engineer) || hasFieldEngineers);

  const pageNotices = useMemo(() => {
    const items: Array<{ id: string; message: ReactNode; tone?: "info" | "warning" | "neutral" }> = [];

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
            Ticket is open. Choose <span className="font-medium">Mode</span> and{" "}
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

    if (!canWork && !isPreview && !isViewOnly && !canOpen) {
      items.push({
        id: "other-owner",
        tone: "neutral",
        message:
          "This ticket is assigned to another engineer. Only the owner and co-owners can open and work on it.",
      });
    }

    return items;
  }, [canOpen, canWork, isPreview, isViewOnly, needsAssetConfirm, needsSupportChoice]);

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

  const syncVisitTotal = (movement: string, charges: string) => {
    const m = Number(movement);
    const c = Number(charges);
    if (!Number.isFinite(m) && !Number.isFinite(c)) return;
    const total = (Number.isFinite(m) ? m : 0) + (Number.isFinite(c) ? c : 0);
    setVisitTotal(String(total));
  };

  const saveVisitPayload = () => ({
    engineer_name: visitName.trim(),
    engineer_contact: visitContact.trim() || null,
    distance: visitDistance.trim() || null,
    visits_count: visitVisits ? Number(visitVisits) : null,
    carrying_spares: visitCarrying === "true",
    visit_date: visitDate || null,
    hw_replacement: visitHw.trim() || null,
    transport_mode: visitTransport.trim() || null,
    movement_charges: visitMovement ? Number(visitMovement) : null,
    visit_charges: visitChargesAmt ? Number(visitChargesAmt) : null,
    total_charges: visitTotal ? Number(visitTotal) : null,
    remarks: visitRemarks.trim() || null,
  });

  const onUpdateVisitDetails = async () => {
    if (!visitName.trim()) {
      setError("Enter field engineer name.");
      return;
    }
    setSavingVisit(true);
    setError(null);
    try {
      await updateServiceRequestTicket(ticketId, { field_engineer: saveVisitPayload() });
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
    if (!visitName.trim() || !visitEmail.trim()) {
      setError("Name and email are required to add a field engineer.");
      return;
    }
    setSavingVisit(true);
    setError(null);
    try {
      await updateServiceRequestTicket(ticketId, { field_engineer: saveVisitPayload() });
      const payload = {
        engineer_name: visitName.trim(),
        engineer_email: visitEmail.trim(),
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
      let created = await addTicketFieldEngineer(ticketId, payload);
      if (!created.temporary_password && created.id) {
        created = await issueTicketFieldEngineerCredentials(ticketId, created.id);
      }
      setFeCredsNotice({
        email: created.login_email || created.engineer_email,
        password: created.temporary_password,
        note: created.credentials_note,
        emailed: Boolean(created.credentials_email_sent),
        created: Boolean(created.account_created),
      });
      resetFeForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save field engineer");
    } finally {
      setSavingVisit(false);
    }
  };

  const onShowFeCredentials = async (feId: string) => {
    setError(null);
    try {
      const creds = await issueTicketFieldEngineerCredentials(ticketId, feId);
      setFeCredsNotice({
        email: creds.login_email || creds.engineer_email,
        password: creds.temporary_password,
        note: creds.credentials_note,
        emailed: Boolean(creds.credentials_email_sent),
        created: Boolean(creds.account_created),
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to issue FE login credentials");
    }
  };

  const onResolve = async () => {
    if (!solutionSummary.trim() || resolving) return;
    setResolving(true);
    setError(null);
    try {
      await resolveTicket(ticketId, {
        solution_type: solutionType,
        solution_summary: solutionSummary.trim(),
      });
      setSolutionSummary("");
      setResolveOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to resolve ticket");
    } finally {
      setResolving(false);
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
        description={`${ticket.document_number} · ${formatStatus(ticket.status)}`}
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
            {canWork && supportChosen && assetConfirmed && ticket.status !== "resolved" && ticket.status !== "closed" ? (
              <Button type="button" size="sm" onClick={() => setResolveOpen(true)}>
                End Ticket
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {resolveOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="presentation"
          onClick={() => {
            if (!resolving) setResolveOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-dialog-title"
            className="w-full max-w-md rounded-xl border border-border/80 bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="resolve-dialog-title" className="text-sm font-medium tracking-tight">
              End Ticket
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Enter the solution details. This ends the SLA and closes the ticket.
            </p>
            <label className="mt-4 mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Reason / type
            </label>
            <select
              className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={solutionType}
              onChange={(e) => setSolutionType(e.target.value)}
              disabled={resolving}
            >
              {SOLUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Description
            </label>
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Describe the solution provided…"
              value={solutionSummary}
              onChange={(e) => setSolutionSummary(e.target.value)}
              disabled={resolving}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolving}
                onClick={() => setResolveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!solutionSummary.trim() || resolving}
                onClick={() => void onResolve()}
              >
                {resolving ? "Ending…" : "Confirm — End & Close Ticket"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
        <span className="mr-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</span>
        <FinanceStatusBadge status={ticket.priority} />
        <FinanceStatusBadge status={ticket.status} />
        {ticket.mode_of_action ? <FinanceStatusBadge status={ticket.mode_of_action} /> : null}
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
                  label="Mode"
                  value={ticket.mode_of_action ?? ""}
                  options={modeOptions}
                  placeholder="Select mode…"
                  onChange={(value) =>
                    void updateServiceRequestTicket(ticketId, { mode_of_action: value || null })
                      .then(load)
                      .catch((err) =>
                        setError(err instanceof ApiClientError ? err.message : "Failed to set mode"),
                      )
                  }
                />
              ) : (
                <DetailRow
                  label="Mode"
                  value={
                    ticket.mode_of_action
                      ? formatStatus(ticket.mode_of_action)
                      : canOpen
                        ? "Choose after opening ticket"
                        : isOpened
                          ? "Select mode…"
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
              <DetailRow label="SLA Status" value={ticket.sla_status ?? (ticket.sla_started_at ? "within_sla" : "Not started")} />
              <DetailRow
                label="Ticket Start"
                value={(ticket.ticket_start_at || ticket.sla_started_at || ticket.created_at)?.slice(0, 16)}
              />
              <DetailRow
                label="Ticket End"
                value={(ticket.ticket_end_at || ticket.closed_at || ticket.resolved_at)?.slice(0, 16) || "Open"}
              />
              {ticket.sla_started_at ? (
                <DetailRow label="SLA Started" value={ticket.sla_started_at.slice(0, 16)} />
              ) : (
                <DetailRow label="SLA Clock" value="Starts on ticket create / email receipt" />
              )}
              {ticket.due_at ? <DetailRow label="SLA Due" value={ticket.due_at.slice(0, 16)} /> : null}
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Issue Description">
            <ProseBlock>{ticket.issue_description || ticket.description || "—"}</ProseBlock>
          </SectionCard>

          {(ticket.reference_sr_number ||
            ticket.ckt_id ||
            ticket.lsi ||
            ticket.company_name_from_mail ||
            ticket.end_customer_name ||
            ticket.site_availability ||
            ticket.link_type ||
            ticket.bandwidth ||
            ticket.ports_in_use ||
            ticket.site_instructions ||
            ticket.ip_details ||
            ticket.previous_fe_notes ||
            ticket.mail_extra_info) ? (
            <SectionCard title="Circuit / Site (from email)">
              <DetailGrid>
                <DetailRow label="SR Number" value={ticket.reference_sr_number} />
                <DetailRow label="CKT ID" value={ticket.ckt_id || ticket.lsi} />
                <DetailRow label="Company (mail)" value={ticket.company_name_from_mail || ticket.customer_reference} />
                <DetailRow label="End Customer" value={ticket.end_customer_name} />
                <DetailRow label="LC / Coordinator Phone" value={ticket.coordinator_phone} />
                <DetailRow label="Site Availability" value={ticket.site_availability} />
                <DetailRow label="Link Type" value={ticket.link_type} />
                <DetailRow label="Bandwidth" value={ticket.bandwidth} />
                <DetailRow label="Ports in Use" value={ticket.ports_in_use} />
                <DetailRow label="Address" value={ticket.end_customer_street} />
                <DetailRow label="City / State" value={[ticket.end_customer_city, ticket.end_customer_state].filter(Boolean).join(", ") || null} />
                <DetailRow label="PIN" value={ticket.end_customer_postal_code} />
              </DetailGrid>
              {ticket.site_instructions ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Site instructions</p>
                  <ProseBlock>{ticket.site_instructions}</ProseBlock>
                </div>
              ) : null}
              {ticket.ip_details ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">IP / credentials</p>
                  <ProseBlock>{ticket.ip_details}</ProseBlock>
                </div>
              ) : null}
              {ticket.previous_fe_notes ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Previous FE</p>
                  <ProseBlock>{ticket.previous_fe_notes}</ProseBlock>
                </div>
              ) : null}
              {ticket.mail_extra_info ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Other</p>
                  <ProseBlock>{ticket.mail_extra_info}</ProseBlock>
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
                        onCommit={(value) =>
                          void updateServiceRequestTicket(ticketId, { asset_name: value })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save asset name"),
                            )
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
                          void updateServiceRequestTicket(ticketId, { asset_status: value || null })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save device type"),
                            )
                        }
                      />
                      <DetailInput
                        label="Serial Number"
                        value={ticket.serial_number}
                        placeholder="From mail — device serial"
                        onCommit={(value) =>
                          void updateServiceRequestTicket(ticketId, { serial_number: value })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save serial number"),
                            )
                        }
                      />
                      <DetailInput
                        label="Warranty Start"
                        value={ticket.warranty_start_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void updateServiceRequestTicket(ticketId, { warranty_start_date: value })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save warranty start"),
                            )
                        }
                      />
                      <DetailInput
                        label="Warranty End"
                        value={ticket.warranty_end_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void updateServiceRequestTicket(ticketId, { warranty_end_date: value })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save warranty end"),
                            )
                        }
                      />
                      <DetailInput
                        label="AMC End"
                        value={ticket.amc_end_date?.slice(0, 10)}
                        type="date"
                        onCommit={(value) =>
                          void updateServiceRequestTicket(ticketId, { amc_end_date: value })
                            .then(load)
                            .catch((err) =>
                              setError(err instanceof ApiClientError ? err.message : "Failed to save AMC end"),
                            )
                        }
                      />
                    </DetailGrid>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        void updateServiceRequestTicket(ticketId, {
                          asset_confirmed_at: new Date().toISOString(),
                        })
                          .then(load)
                          .catch((err) =>
                            setError(err instanceof ApiClientError ? err.message : "Failed to confirm asset details"),
                          )
                      }
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
                  </DetailGrid>
                )}
              </SectionCard>

          {showVisitSection ? (
            <SectionCard title="Field Engineer Visit">
              {canEditVisitPlan ? (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Fill visit details, enter the FE email, then add the field engineer. Login credentials are created
                    automatically.
                  </p>
                  {feCredsNotice ? (
                    <div className="mb-4 rounded-md border-2 border-emerald-600 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 shadow-sm">
                      <p className="font-semibold text-base">Field engineer login credentials</p>
                      <p className="mt-2">
                        Login ID:{" "}
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">{feCredsNotice.email}</code>
                      </p>
                      {feCredsNotice.password ? (
                        <p className="mt-2">
                          Password:{" "}
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">
                            {feCredsNotice.password}
                          </code>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs">No password returned — click Show login on the FE row.</p>
                      )}
                      <p className="mt-2 text-xs">
                        Sign in at http://localhost:3000/login → Service → Field Engineer
                      </p>
                      <p className="mt-1 text-xs text-emerald-900/80">
                        {feCredsNotice.emailed
                          ? "Also emailed to the field engineer."
                          : feCredsNotice.note ||
                            "Copy and share these credentials now (they are not stored in plain text)."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {feCredsNotice.password ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                `Login: ${feCredsNotice.email}\nPassword: ${feCredsNotice.password}`,
                              )
                            }
                          >
                            Copy credentials
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="ghost" onClick={() => setFeCredsNotice(null)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Field Engineer Name">
                      <Input value={visitName} onChange={(e) => setVisitName(e.target.value)} />
                    </FormField>
                    <FormField label="Contact Number">
                      <Input value={visitContact} onChange={(e) => setVisitContact(e.target.value)} />
                    </FormField>
                    <FormField label="Distance from FE Location">
                      <Input value={visitDistance} onChange={(e) => setVisitDistance(e.target.value)} />
                    </FormField>
                    <FormField label="Number of Visits">
                      <Input
                        type="number"
                        min={0}
                        value={visitVisits}
                        onChange={(e) => setVisitVisits(e.target.value)}
                      />
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
                    <FormField label="HW Replacement">
                      <Input
                        placeholder="-None-"
                        value={visitHw}
                        onChange={(e) => setVisitHw(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Mode of Transport">
                      <Input value={visitTransport} onChange={(e) => setVisitTransport(e.target.value)} />
                    </FormField>
                    <FormField label="Movement Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitMovement}
                        onChange={(e) => {
                          setVisitMovement(e.target.value);
                          syncVisitTotal(e.target.value, visitChargesAmt);
                        }}
                      />
                    </FormField>
                    <FormField label="Visit Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitChargesAmt}
                        onChange={(e) => {
                          setVisitChargesAmt(e.target.value);
                          syncVisitTotal(visitMovement, e.target.value);
                        }}
                      />
                    </FormField>
                    <FormField label="Total Charges">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={visitTotal}
                        onChange={(e) => setVisitTotal(e.target.value)}
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

                  <div className="mt-5 border-t border-border/60 pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Add field engineer
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Email (login ID)">
                        <Input
                          type="email"
                          placeholder="fe@example.com"
                          value={visitEmail}
                          onChange={(e) => setVisitEmail(e.target.value)}
                        />
                      </FormField>
                      <div className="sm:col-span-2">
                        <FormField label="Work brief for FE">
                          <textarea
                            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="What to do on site…"
                            value={feBrief}
                            onChange={(e) => setFeBrief(e.target.value)}
                          />
                        </FormField>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={feShowIssue} onChange={(e) => setFeShowIssue(e.target.checked)} />
                        Show issue
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={feShowCustomer}
                          onChange={(e) => setFeShowCustomer(e.target.checked)}
                        />
                        Show customer / LC
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={feShowSite} onChange={(e) => setFeShowSite(e.target.checked)} />
                        Show site / address
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={feShowAsset} onChange={(e) => setFeShowAsset(e.target.checked)} />
                        Show asset / serial
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={feShowCircuit}
                          onChange={(e) => setFeShowCircuit(e.target.checked)}
                        />
                        Show circuit / IP
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingVisit || !visitName.trim() || !visitEmail.trim()}
                        onClick={() => void onAddFieldEngineer()}
                      >
                        {savingVisit
                          ? "Saving…"
                          : editingFeId
                            ? "Save FE changes"
                            : "Add Field Engineer"}
                      </Button>
                      {editingFeId ? (
                        <Button type="button" size="sm" variant="ghost" onClick={resetFeForm}>
                          Cancel edit
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingVisit || !visitName.trim()}
                          onClick={() => void onUpdateVisitDetails()}
                        >
                          Update visit details only
                        </Button>
                      )}
                    </div>
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void onShowFeCredentials(fe.id)}
                                >
                                  Show login
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => startEditFe(fe)}>
                                  Edit
                                </Button>
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
                <DetailGrid>
                  <DetailRow label="Field Engineer Name" value={ticket?.field_engineer?.engineer_name} />
                  <DetailRow label="Contact Number" value={ticket?.field_engineer?.engineer_contact} />
                  <DetailRow label="Distance from FE Location" value={ticket?.field_engineer?.distance} />
                  <DetailRow
                    label="Number of Visits"
                    value={
                      ticket?.field_engineer?.visits_count != null
                        ? String(ticket.field_engineer.visits_count)
                        : null
                    }
                  />
                  <DetailRow
                    label="Engineer Carrying spares tools"
                    value={ticket?.field_engineer?.carrying_spares ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="Site Visit Date"
                    value={ticket?.field_engineer?.visit_date?.slice(0, 10) ?? null}
                  />
                  <DetailRow
                    label="HW Replacement"
                    value={ticket?.field_engineer?.hw_replacement || "-None-"}
                  />
                  <DetailRow label="Mode of Transport" value={ticket?.field_engineer?.transport_mode} />
                  <DetailRow
                    label="Movement Charges"
                    value={
                      ticket?.field_engineer?.movement_charges != null
                        ? String(ticket.field_engineer.movement_charges)
                        : null
                    }
                  />
                  <DetailRow
                    label="Visit Charges"
                    value={
                      ticket?.field_engineer?.visit_charges != null
                        ? String(ticket.field_engineer.visit_charges)
                        : null
                    }
                  />
                  <DetailRow
                    label="Total Charges"
                    value={
                      ticket?.field_engineer?.total_charges != null
                        ? String(ticket.field_engineer.total_charges)
                        : null
                    }
                  />
                  {ticket?.field_engineer?.remarks ? (
                    <div className="sm:col-span-2">
                      <DetailRow label="Remarks" value={ticket.field_engineer.remarks} />
                    </div>
                  ) : null}
                </DetailGrid>
              )}
            </SectionCard>
          ) : null}

          {canWork || ticketEnded ? (
            <>
              {ticket.oem_support_enabled && ticket.oem_support ? (
                <SectionCard title="OEM Support">
                  <DetailGrid>
                    <DetailRow label="OEM Name" value={ticket.oem_support.oem_name} />
                    <DetailRow label="OEM Ticket #" value={ticket.oem_support.oem_ticket_number} />
                    <DetailRow label="Ticket Type" value={ticket.oem_support.ticket_type} />
                    <DetailRow label="OEM Status" value={ticket.oem_support.oem_status} />
                    <DetailRow label="TAC Summary" value={ticket.oem_support.tac_response_summary} />
                    <DetailRow label="TAC Resolution" value={ticket.oem_support.tac_resolution} />
                  </DetailGrid>
                </SectionCard>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {(canWork || access?.is_manager || isViewOnly || isPreview || ticketEnded) ? (
            <SectionCard title="Ticket Timeline">
              <div className="mb-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportTicketTimelineXlsx(ticketId).catch((err) =>
                      setError(err instanceof ApiClientError ? err.message : "Timeline export failed"),
                    )
                  }
                >
                  Excel Export
                </Button>
              </div>
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                {timeline.length === 0 ? (
                  <li className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
                    No activity yet.
                  </li>
                ) : (
                  timeline.map((item, i) => (
                    <li
                      key={`${item.occurred_at}-${i}`}
                      className="min-w-0 rounded-md border border-border/50 bg-background px-3 py-2.5"
                    >
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {item.occurred_at?.slice(0, 16)?.replace("T", " ") || "—"}
                      </p>
                      <p className="mt-0.5 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                        {item.title}
                      </p>
                      {item.description ? (
                        <p className="mt-1 break-words text-xs leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
                          {formatServiceDisplayText(item.description)}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
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
                    <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Summary
                    </p>
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
                This ticket is assigned to you. Open it to begin work, then choose Mode and Category in Basic Information. Those choices are fixed after you select them.
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

          {access?.can_reopen ? (
            <SectionCard title="Reopen">
              <p className="mb-2 text-xs text-muted-foreground">
                Ownership stays with you after reopening. Co-owners are preserved.
              </p>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void reopenTicket(ticketId).then(load)}>
                Reopen Ticket
              </Button>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
