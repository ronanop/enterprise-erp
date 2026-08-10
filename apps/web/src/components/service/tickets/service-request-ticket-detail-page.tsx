"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Edit, MessageSquare, Paperclip, RefreshCw, UserPlus, Users } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/api-client";
import {
  addTicketCoOwner,
  addTicketComment,
  addTicketStakeholder,
  ApiClientError,
  assignTicketOwner,
  attachmentDownloadUrl,
  changeTicketStatus,
  closeTicket,
  deleteTicketAttachment,
  formatStatus,
  getServiceRequestTicket,
  getTicketStakeholderView,
  getTicketTimeline,
  listAssignableEmployees,
  listTicketAttachments,
  listTicketComments,
  loadTicketFormLookups,
  openTicket,
  removeTicketCoOwner,
  removeTicketStakeholder,
  reopenTicket,
  resolveTicket,
  SOLUTION_TYPES,
  type LookupOption,
  type ServiceRequestTicket,
  type TicketAttachment,
  type TicketComment,
  type TicketStakeholderView,
  type TimelineItem,
  uploadTicketAttachment,
} from "@/services/service-request-ticket-service";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function StakeholderStatusCard({ view }: { view: TicketStakeholderView }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={view.subject}
        description={`${view.document_number} · Status view only`}
      />
      <SectionCard title="Ticket Status">
        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Status" value={formatStatus(view.status)} />
          <DetailRow label="Resolved" value={view.is_resolved ? "Yes" : "No"} />
          <DetailRow label="Closed" value={view.is_closed ? "Yes" : "No"} />
          <DetailRow label="Resolved At" value={view.resolved_at?.slice(0, 16) ?? null} />
          <DetailRow label="Closed At" value={view.closed_at?.slice(0, 16) ?? null} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          You are listed as a contact on this ticket. Communication happens via email; this portal shows resolution status only.
        </p>
      </SectionCard>
    </div>
  );
}

export function ServiceRequestTicketDetailPage({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<ServiceRequestTicket | null>(null);
  const [stakeholderView, setStakeholderView] = useState<TicketStakeholderView | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [employees, setEmployees] = useState<LookupOption[]>([]);
  const [commentText, setCommentText] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [coOwnerId, setCoOwnerId] = useState("");
  const [stakeholderName, setStakeholderName] = useState("");
  const [stakeholderEmail, setStakeholderEmail] = useState("");
  const [solutionType, setSolutionType] = useState("installation");
  const [solutionSummary, setSolutionSummary] = useState("");
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

      try {
        const t = await getServiceRequestTicket(ticketId);
        setTicket(t);
        const access = t.access;
        if (access?.can_work) {
          const [c, a, tl] = await Promise.all([
            listTicketComments(ticketId),
            listTicketAttachments(ticketId),
            getTicketTimeline(ticketId),
          ]);
          setComments(c);
          setAttachments(a);
          setTimeline(tl);
        } else {
          setComments([]);
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

  const access = ticket?.access;
  const canWork = access?.can_work ?? false;
  const canOpen = access?.can_open ?? false;
  const canManage = access?.can_manage_collaborators ?? false;
  const isPreview = access?.level === "assign_preview";
  const isViewOnly = access?.level === "view_only";

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

  const onAddStakeholder = async () => {
    if (!stakeholderName.trim() || !stakeholderEmail.trim()) return;
    await addTicketStakeholder(ticketId, {
      name: stakeholderName.trim(),
      email: stakeholderEmail.trim(),
    });
    setStakeholderName("");
    setStakeholderEmail("");
    await load();
  };

  const onResolve = async () => {
    if (!solutionSummary.trim()) return;
    await resolveTicket(ticketId, {
      solution_type: solutionType,
      solution_summary: solutionSummary.trim(),
    });
    setSolutionSummary("");
    await load();
  };

  const onAddComment = async () => {
    if (!commentText.trim() || !canWork) return;
    await addTicketComment(ticketId, commentText.trim());
    setCommentText("");
    await load();
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

  const onStatusChange = async (status: string) => {
    if (!canWork) return;
    await changeTicketStatus(ticketId, status);
    await load();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading ticket…</div>;
  if (stakeholderView) return <StakeholderStatusCard view={stakeholderView} />;
  if (error && !ticket) return <div className="text-destructive">{error}</div>;
  if (!ticket) return null;

  return (
    <div className="space-y-4">
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
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isViewOnly ? (
        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
          View-only access. As service head you can see this ticket but cannot open or work on it. Only the assigned engineer can open the ticket and start the SLA clock.
        </div>
      ) : null}

      {isPreview ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          This ticket is unassigned. Everyone in the service module can see it here. A coordinator must assign an owner before work can begin.
        </div>
      ) : null}

      {!canWork && !isPreview && !isViewOnly && !canOpen ? (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This ticket is assigned to another engineer. Only the owner and co-owners can open and work on it.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <FinanceStatusBadge status={ticket.priority} />
        <FinanceStatusBadge status={ticket.status} />
        {ticket.mode_of_action ? <FinanceStatusBadge status={ticket.mode_of_action} /> : null}
        {access?.is_owner ? <FinanceStatusBadge status="owner" /> : null}
        {access?.is_co_owner ? <FinanceStatusBadge status="co_owner" /> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Basic Information">
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Contact Name" value={ticket.contact_name} />
              <DetailRow label="Email" value={ticket.email} />
              <DetailRow label="Mobile" value={ticket.mobile} />
              <DetailRow label="Channel" value={ticket.channel} />
              <DetailRow label="Mode" value={ticket.mode_of_action ? formatStatus(ticket.mode_of_action) : null} />
              <DetailRow label="Priority" value={ticket.priority.toUpperCase()} />
              <DetailRow label="Category" value={ticket.ticket_category} />
              <DetailRow label="SLA Status" value={ticket.sla_status ?? (ticket.sla_started_at ? "within_sla" : "Not started")} />
              {ticket.sla_started_at ? (
                <DetailRow label="SLA Started" value={ticket.sla_started_at.slice(0, 16)} />
              ) : (
                <DetailRow label="SLA Clock" value="Starts when engineer opens ticket" />
              )}
              {ticket.due_at ? <DetailRow label="SLA Due" value={ticket.due_at.slice(0, 16)} /> : null}
            </dl>
          </SectionCard>

          <SectionCard title="Issue Description">
            <p className="text-sm whitespace-pre-wrap">{ticket.issue_description || ticket.description || "—"}</p>
          </SectionCard>

          {ticket.solution_summary ? (
            <SectionCard title="Solution">
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Type" value={ticket.solution_type ? formatStatus(ticket.solution_type) : null} />
                <DetailRow label="Resolved At" value={ticket.resolved_at?.slice(0, 16)} />
              </dl>
              <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.solution_summary}</p>
            </SectionCard>
          ) : null}

          {canWork ? (
            <>
              <SectionCard title="Asset Details">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Asset Name" value={ticket.asset_name} />
                  <DetailRow label="Serial Number" value={ticket.serial_number} />
                  <DetailRow label="Warranty Start" value={ticket.warranty_start_date?.slice(0, 10)} />
                  <DetailRow label="Warranty End" value={ticket.warranty_end_date?.slice(0, 10)} />
                  <DetailRow label="AMC End" value={ticket.amc_end_date?.slice(0, 10)} />
                  <DetailRow label="Asset Status" value={ticket.asset_status} />
                </dl>
              </SectionCard>

              {ticket.mode_of_action === "onsite_support" && ticket.field_engineer ? (
                <SectionCard title="Field Engineer Visit">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Engineer Name" value={ticket.field_engineer.engineer_name} />
                    <DetailRow label="Contact" value={ticket.field_engineer.engineer_contact} />
                    <DetailRow label="Visit Date" value={ticket.field_engineer.visit_date?.slice(0, 10)} />
                    <DetailRow
                      label="Total Charges"
                      value={ticket.field_engineer.total_charges != null ? String(ticket.field_engineer.total_charges) : null}
                    />
                    <DetailRow label="Remarks" value={ticket.field_engineer.remarks} />
                  </dl>
                </SectionCard>
              ) : null}

              {ticket.oem_support_enabled && ticket.oem_support ? (
                <SectionCard title="OEM Support">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="OEM Name" value={ticket.oem_support.oem_name} />
                    <DetailRow label="OEM Ticket #" value={ticket.oem_support.oem_ticket_number} />
                    <DetailRow label="Ticket Type" value={ticket.oem_support.ticket_type} />
                    <DetailRow label="OEM Status" value={ticket.oem_support.oem_status} />
                    <DetailRow label="TAC Summary" value={ticket.oem_support.tac_response_summary} />
                    <DetailRow label="TAC Resolution" value={ticket.oem_support.tac_resolution} />
                  </dl>
                </SectionCard>
              ) : null}

              <SectionCard title="Comments">
                <div className="mb-3 flex gap-2">
                  <Input
                    placeholder="Add internal comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={() => void onAddComment()}>
                    <MessageSquare className="size-3.5" />
                    Post
                  </Button>
                </div>
                <ul className="space-y-2">
                  {comments.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No comments yet.</li>
                  ) : (
                    comments.map((c) => (
                      <li key={c.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                        <p className="whitespace-pre-wrap">{c.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{c.commented_at?.slice(0, 16)}</p>
                      </li>
                    ))
                  )}
                </ul>
              </SectionCard>

              <SectionCard title="Attachments">
                <div className="mb-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted/40">
                    <Paperclip className="size-4" />
                    Upload file (max 40MB)
                    <input type="file" className="hidden" onChange={(e) => void onUpload(e)} />
                  </label>
                </div>
                <ul className="space-y-2">
                  {attachments.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No attachments.</li>
                  ) : (
                    attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                        <a
                          href={attachmentDownloadUrl(ticketId, a.id)}
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {a.file_name}
                        </a>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {a.file_size ? `${Math.round(a.file_size / 1024)} KB` : ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteTicketAttachment(ticketId, a.id).then(load)}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </SectionCard>
            </>
          ) : null}
        </div>

        <div className="space-y-4">
          {canOpen ? (
            <SectionCard title="Open Ticket">
              <p className="mb-3 text-sm text-muted-foreground">
                This ticket is assigned to you. Click below to open it and start the SLA clock. Until you open it, the ticket stays in assigned status.
              </p>
              <Button type="button" className="w-full" onClick={() => void onOpenTicket()}>
                Open Ticket & Start SLA
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

          {canManage ? (
            <SectionCard title="Contacts (Status Only)">
              <p className="mb-2 text-xs text-muted-foreground">
                External contacts see only whether the ticket is resolved or closed. They communicate via email.
              </p>
              <Input
                className="mb-2"
                placeholder="Name"
                value={stakeholderName}
                onChange={(e) => setStakeholderName(e.target.value)}
              />
              <Input
                className="mb-2"
                placeholder="Email"
                type="email"
                value={stakeholderEmail}
                onChange={(e) => setStakeholderEmail(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mb-3 w-full"
                disabled={!stakeholderName.trim() || !stakeholderEmail.trim()}
                onClick={() => void onAddStakeholder()}
              >
                Add Contact
              </Button>
              <ul className="space-y-1 text-sm">
                {(ticket.stakeholders ?? []).length === 0 ? (
                  <li className="text-muted-foreground">No contacts added.</li>
                ) : (
                  ticket.stakeholders?.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded border border-border/50 px-2 py-1">
                      <span>
                        {s.name} <span className="text-muted-foreground">({s.email})</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeTicketStakeholder(ticketId, s.id).then(load)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </SectionCard>
          ) : null}

          {canWork && ticket.status !== "resolved" && ticket.status !== "closed" ? (
            <SectionCard title="Provide Solution">
              <select
                className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={solutionType}
                onChange={(e) => setSolutionType(e.target.value)}
              >
                {SOLUTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                className="mb-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Describe the solution provided…"
                value={solutionSummary}
                onChange={(e) => setSolutionSummary(e.target.value)}
              />
              <Button type="button" size="sm" className="w-full" disabled={!solutionSummary.trim()} onClick={() => void onResolve()}>
                Resolve Ticket
              </Button>
            </SectionCard>
          ) : null}

          {canWork ? (
            <SectionCard title="Workflow">
              <div className="flex flex-col gap-2">
                {["engineer_working", "pending_customer", "pending_oem"].includes(ticket.status) ? (
                  <>
                    <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => void onStatusChange("pending_customer")}>
                      Mark Pending Customer
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => void onStatusChange("pending_oem")}>
                      Mark Pending OEM
                    </Button>
                  </>
                ) : null}
                {ticket.status === "resolved" ? (
                  <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => void closeTicket(ticketId).then(load)}>
                    Close Ticket
                  </Button>
                ) : null}
              </div>
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

          {canWork ? (
            <SectionCard title="Timeline">
              <ul className="space-y-3">
                {timeline.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No activity yet.</li>
                ) : (
                  timeline.map((item, i) => (
                    <li key={`${item.occurred_at}-${i}`} className="border-l-2 border-primary/30 pl-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                      <p className="text-[11px] text-muted-foreground">{item.occurred_at?.slice(0, 16)}</p>
                    </li>
                  ))
                )}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
