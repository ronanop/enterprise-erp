"use client";

import { newUuid } from "@/lib/uuid";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadEmployeeDirectory, readFileAsDataUrl } from "@/services/employee-management-service";
import { sendEmailCompose } from "@/services/email-notification-service";
import {
  acceptanceStats,
  createOrgDocument,
  deleteOrgDocument,
  listOrgDocuments,
  MAX_ORG_DOC_ATTACHMENT_BYTES,
  MAX_ORG_DOC_ATTACHMENTS,
  sendOrgDocument,
  updateOrgDocument,
  type OrgDocAttachment,
  type OrgDocKind,
  type OrgDocument,
} from "@/services/edoc-org-documents-service";
import {
  listManagementGroups,
  type ManagementGroup,
} from "@/services/management-group-service";
import type { EmployeeRecord } from "@/types/employee-management";

const KIND_OPTIONS: { value: OrgDocKind; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "handbook", label: "Handbook" },
  { value: "contract", label: "Contract" },
  { value: "notice", label: "Notice" },
  { value: "other", label: "Other" },
];

type Mode = "create" | "edit" | "view" | "send" | "status" | null;
/** Who receives the policy / document. */
type SendTarget = "all" | "department" | "managers" | "group" | "single";

const AUDIENCE_OPTIONS: { value: SendTarget; label: string; hint: string }[] = [
  { value: "all", label: "All employees", hint: "Everyone in the directory" },
  { value: "department", label: "Department", hint: "One department team" },
  { value: "managers", label: "Managers", hint: "People who are reporting managers" },
  { value: "group", label: "Employment group", hint: "Management / employment group" },
  { value: "single", label: "Single person", hint: "One employee only" },
];

function employeeEmail(emp: EmployeeRecord): string {
  return (
    emp.extension?.personal?.personalEmail ||
    emp.extension?.personal?.email ||
    emp.officialEmail ||
    ""
  );
}

function employeeGroupId(emp: EmployeeRecord): string {
  return emp.extension?.employment?.managementGroupId || "";
}

function employeeDeptKey(emp: EmployeeRecord): string {
  return emp.departmentId || emp.departmentName || "";
}

function employeeDeptLabel(emp: EmployeeRecord): string {
  return emp.departmentName || emp.departmentId || "Unassigned";
}

function policyEmailHtml(doc: OrgDocument): string {
  const bodyPreview = (doc.body || "")
    .slice(0, 1200)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  const files =
    doc.attachments?.length > 0
      ? `<p style="font-size:13px;color:#475569">Attachments: ${doc.attachments
          .map((a) => a.fileName)
          .join(", ")}</p>`
      : "";
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.5">
      <p>Hello,</p>
      <p>You have been sent an organisational document to review and accept:</p>
      <p style="font-size:16px;font-weight:600">${doc.title.replace(/</g, "&lt;")}</p>
      <p style="font-size:12px;color:#64748b">${doc.code} · ${doc.kind}</p>
      ${files}
      <div style="margin:16px 0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:13px">
        ${bodyPreview || "<em>(See attachments / ESS for full content)</em>"}
      </div>
      <p style="font-size:13px">Please open <strong>Employee Requests → Org docs</strong> (or ESS) to accept this document.</p>
      <p style="font-size:12px;color:#64748b">— HR Team</p>
    </div>
  `;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EdocOtherDocumentsPanel() {
  const [rows, setRows] = useState<OrgDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [groups, setGroups] = useState<ManagementGroup[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [active, setActive] = useState<OrgDocument | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<OrgDocKind>("policy");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<OrgDocAttachment[]>([]);
  const [sendTarget, setSendTarget] = useState<SendTarget>("all");
  const [departmentKey, setDepartmentKey] = useState("");
  const [groupId, setGroupId] = useState("");
  const [singleId, setSingleId] = useState("");
  const [sendQuery, setSendQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [previewFile, setPreviewFile] = useState<OrgDocAttachment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OrgDocument | null>(null);

  const reload = useCallback(() => {
    setRows(listOrgDocuments());
  }, []);

  useEffect(() => {
    reload();
    void Promise.all([
      loadEmployeeDirectory().catch(() => ({ records: [] as EmployeeRecord[] })),
      listManagementGroups().catch(() => [] as ManagementGroup[]),
    ]).then(([dir, mg]) => {
      setEmployees(dir.records ?? []);
      setGroups((mg ?? []).filter((g) => g.status === "active"));
    });
  }, [reload]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      const key = employeeDeptKey(e);
      if (!key) continue;
      if (!map.has(key)) map.set(key, employeeDeptLabel(e));
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  const managerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of employees) {
      const mid = e.reportingManagerId || "";
      if (mid) ids.add(mid);
    }
    return ids;
  }, [employees]);

  const groupMembers = useMemo(() => {
    if (!groupId) return [];
    return employees.filter((e) => employeeGroupId(e) === groupId);
  }, [employees, groupId]);

  const addableEmployees = useMemo(() => {
    if (sendTarget !== "group" || !groupId) return [];
    const q = sendQuery.trim().toLowerCase();
    return employees.filter((e) => {
      if (employeeGroupId(e) === groupId) return false;
      if (selectedIds.has(e.id)) return false;
      if (!q) return true;
      return [e.displayName, e.employeeCode, employeeEmail(e), e.departmentName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [employees, groupId, selectedIds, sendQuery, sendTarget]);

  const filteredSingles = useMemo(() => {
    const q = sendQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.displayName, e.employeeCode, employeeEmail(e), e.departmentName]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [employees, sendQuery]);

  const audienceRecipients = useMemo(() => {
    switch (sendTarget) {
      case "all":
        return employees;
      case "department":
        if (!departmentKey) return [];
        return employees.filter((e) => employeeDeptKey(e) === departmentKey);
      case "managers":
        return employees.filter((e) => managerIds.has(e.id));
      case "group":
        return employees.filter((e) => selectedIds.has(e.id));
      case "single":
        return singleId ? employees.filter((e) => e.id === singleId) : [];
      default:
        return [];
    }
  }, [
    sendTarget,
    employees,
    departmentKey,
    managerIds,
    selectedIds,
    singleId,
  ]);

  function resetAudience() {
    setSendTarget("all");
    setDepartmentKey("");
    setGroupId(groups[0]?.id ?? "");
    setSingleId("");
    setSendQuery("");
    setSelectedIds(new Set());
  }

  function openCreate() {
    setActive(null);
    setTitle("");
    setKind("policy");
    setBody("");
    setAttachments([]);
    resetAudience();
    setMode("create");
  }

  function openEdit(row: OrgDocument) {
    setActive(row);
    setTitle(row.title);
    setKind(row.kind);
    setBody(row.body);
    setAttachments(row.attachments ?? []);
    resetAudience();
    setMode("edit");
  }

  function openView(row: OrgDocument) {
    setActive(row);
    setTitle(row.title);
    setKind(row.kind);
    setBody(row.body);
    setAttachments(row.attachments ?? []);
    setMode("view");
  }

  function openSend(row: OrgDocument) {
    setActive(row);
    resetAudience();
    setSendTarget("all");
    setMode("send");
  }

  function openStatus(row: OrgDocument) {
    setActive(row);
    setMode("status");
  }

  function onPickGroup(nextGroupId: string) {
    setGroupId(nextGroupId);
    const members = employees.filter((e) => employeeGroupId(e) === nextGroupId);
    setSelectedIds(new Set(members.map((e) => e.id)));
    setSendQuery("");
  }

  async function onUploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = [...attachments];
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_ORG_DOC_ATTACHMENTS) {
        toast(`Maximum ${MAX_ORG_DOC_ATTACHMENTS} attachments`, "error");
        break;
      }
      if (file.size > MAX_ORG_DOC_ATTACHMENT_BYTES) {
        toast(`${file.name} exceeds ${formatBytes(MAX_ORG_DOC_ATTACHMENT_BYTES)}`, "error");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({
          id: newUuid(),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          size: file.size,
        });
      } catch {
        toast(`Could not read ${file.name}`, "error");
      }
    }
    setAttachments(next);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function validateDocContent(): boolean {
    if (!title.trim()) {
      toast("Title is required", "error");
      return false;
    }
    if (!body.trim() && attachments.length === 0) {
      toast("Add content or at least one attachment", "error");
      return false;
    }
    return true;
  }

  function validateAudience(): boolean {
    if (sendTarget === "department" && !departmentKey) {
      toast("Select a department", "error");
      return false;
    }
    if (sendTarget === "group" && selectedIds.size === 0) {
      toast("Select at least one employee in the group", "error");
      return false;
    }
    if (sendTarget === "single" && !singleId) {
      toast("Select an employee", "error");
      return false;
    }
    if (audienceRecipients.length === 0) {
      toast("No employees match this audience", "error");
      return false;
    }
    return true;
  }

  function persistDoc(): OrgDocument | null {
    if (mode === "create" || (mode === "edit" && !active)) {
      return createOrgDocument({ title, kind, body, attachments });
    }
    if ((mode === "edit" || mode === "send") && active) {
      if (mode === "edit") {
        updateOrgDocument(active.id, { title, kind, body, attachments });
      }
      return getLatestDoc(active.id);
    }
    return active;
  }

  function getLatestDoc(id: string): OrgDocument | null {
    return listOrgDocuments().find((r) => r.id === id) ?? null;
  }

  function toSendRecipients(list: EmployeeRecord[]) {
    return list.map((e) => ({
      employeeId: e.id,
      employeeCode: e.employeeCode || e.id.slice(0, 8),
      employeeName: e.displayName || e.employeeCode || "Employee",
      email: employeeEmail(e),
    }));
  }

  function saveDoc() {
    if (!validateDocContent()) return;
    setSaving(true);
    try {
      if (mode === "create") {
        createOrgDocument({ title, kind, body, attachments });
        toast("Document saved as draft");
      } else if (mode === "edit" && active) {
        updateOrgDocument(active.id, { title, kind, body, attachments });
        toast("Document updated");
      }
      setMode(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  function removeDoc(row: OrgDocument) {
    setConfirmDelete(row);
  }

  async function deliverMail(doc: OrgDocument, recipients: EmployeeRecord[]) {
    const withEmail = recipients.filter((e) => employeeEmail(e).trim());
    let mailed = 0;
    let failed = 0;
    for (const e of withEmail) {
      try {
        await sendEmailCompose({
          to_address: employeeEmail(e).trim(),
          subject: `${doc.kind === "policy" ? "Policy" : "Document"}: ${doc.title}`,
          body_html: policyEmailHtml(doc),
          event_type: "hr.edoc.org_document",
          payload_json: {
            document_id: doc.id,
            document_code: doc.code,
            employee_id: e.id,
          },
        });
        mailed += 1;
      } catch {
        failed += 1;
      }
    }
    return { mailed, failed, skipped: recipients.length - withEmail.length };
  }

  async function doSend() {
    if (!active) return;
    if (!validateAudience()) return;
    const recipients = audienceRecipients;
    setSaving(true);
    setSendingMail(true);
    try {
      sendOrgDocument(active.id, toSendRecipients(recipients));
      const mail = await deliverMail(active, recipients);
      toast(
        `Sent to ${recipients.length} employee(s)` +
          (mail.mailed ? ` · ${mail.mailed} email(s) delivered` : "") +
          (mail.failed ? ` · ${mail.failed} email failed` : "") +
          (mail.skipped ? ` · ${mail.skipped} without email` : "") +
          ". They can accept under Employee Requests → Org docs.",
      );
      setMode(null);
      reload();
    } finally {
      setSaving(false);
      setSendingMail(false);
    }
  }

  async function saveAndSendMail() {
    if (!validateDocContent() || !validateAudience()) return;
    setSaving(true);
    setSendingMail(true);
    try {
      const doc = persistDoc();
      if (!doc) {
        toast("Could not save document", "error");
        return;
      }
      const recipients = audienceRecipients;
      sendOrgDocument(doc.id, toSendRecipients(recipients));
      const latest = getLatestDoc(doc.id) ?? doc;
      const mail = await deliverMail(latest, recipients);
      toast(
        `Saved & sent to ${recipients.length}` +
          (mail.mailed ? ` · ${mail.mailed} email(s)` : "") +
          (mail.failed ? ` · ${mail.failed} failed` : "") +
          (mail.skipped ? ` · ${mail.skipped} no email` : ""),
      );
      setMode(null);
      reload();
    } finally {
      setSaving(false);
      setSendingMail(false);
    }
  }

  const drawerTitle =
    mode === "create"
      ? "New document"
      : mode === "edit"
        ? "Edit document"
        : mode === "view"
          ? "View document"
          : mode === "send"
            ? "Send to employees"
            : mode === "status"
              ? "Acceptance status"
              : "";

  const readOnly = mode === "view";
  const busy = saving || sendingMail;

  function audiencePicker() {
    return (
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
        <SetupField
          label="Send to"
          hint={`${audienceRecipients.length} recipient${audienceRecipients.length === 1 ? "" : "s"} selected`}
        >
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                  sendTarget === opt.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 hover:bg-muted/40",
                )}
                onClick={() => {
                  setSendTarget(opt.value);
                  if (opt.value === "group" && groupId) onPickGroup(groupId);
                  if (opt.value !== "group") setSelectedIds(new Set());
                  if (opt.value !== "single") setSingleId("");
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SetupField>

        {sendTarget === "department" ? (
          <SetupField label="Department" required>
            <SetupSelect
              value={departmentKey}
              onChange={(e) => setDepartmentKey(e.target.value)}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
        ) : null}

        {sendTarget === "managers" ? (
          <p className="text-xs text-muted-foreground">
            {audienceRecipients.length} manager
            {audienceRecipients.length === 1 ? "" : "s"} (employees who appear as a reporting
            manager).
          </p>
        ) : null}

        {sendTarget === "all" ? (
          <p className="text-xs text-muted-foreground">
            Will send to all {employees.length} employee{employees.length === 1 ? "" : "s"} in the
            directory.
          </p>
        ) : null}

        {sendTarget === "group" ? (
          <>
            <SetupField label="Employment group" required>
              <SetupSelect value={groupId} onChange={(e) => onPickGroup(e.target.value)}>
                <option value="">Select group…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.group_name} · {g.employment_type}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            {groupId ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    Group members ({groupMembers.length}) — select who receives this
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setSelectedIds(new Set(groupMembers.map((e) => e.id)))}
                    >
                      All in group
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <ul className="erp-scroll max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-card p-1.5">
                  {groupMembers.length === 0 ? (
                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No employees in this group yet. Search to add below.
                    </li>
                  ) : (
                    groupMembers.map((e) => (
                      <li key={e.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selectedIds.has(e.id)}
                            onChange={(ev) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (ev.target.checked) next.add(e.id);
                                else next.delete(e.id);
                                return next;
                              });
                            }}
                          />
                          <span className="min-w-0 truncate font-medium">
                            {e.displayName || e.employeeCode}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {e.employeeCode}
                          </span>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
                <SetupField label="Add employees to this send">
                  <Input
                    value={sendQuery}
                    onChange={(e) => setSendQuery(e.target.value)}
                    placeholder="Search employees to add…"
                    className="h-9"
                  />
                </SetupField>
                {sendQuery.trim() ? (
                  <ul className="erp-scroll max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-card p-1.5">
                    {addableEmployees.slice(0, 40).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/40"
                          onClick={() => setSelectedIds((prev) => new Set(prev).add(e.id))}
                        >
                          <span className="truncate font-medium">
                            {e.displayName || e.employeeCode}
                          </span>
                          <span className="shrink-0 text-[10px] text-primary">+ Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {sendTarget === "single" ? (
          <>
            <SetupField label="Search employee">
              <Input
                value={sendQuery}
                onChange={(e) => setSendQuery(e.target.value)}
                placeholder="Name, code, email…"
                className="h-9"
              />
            </SetupField>
            <ul className="erp-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-card p-1.5">
              {filteredSingles.slice(0, 60).map((e) => {
                const selected = singleId === e.id;
                return (
                  <li key={e.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40",
                        selected && "bg-primary/5",
                      )}
                    >
                      <input
                        type="radio"
                        name="edoc-single-employee"
                        className="cursor-pointer"
                        checked={selected}
                        onChange={() => setSingleId(e.id)}
                      />
                      <span className="min-w-0 truncate font-medium">
                        {e.displayName || e.employeeCode}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {e.employeeCode}
                        {e.departmentName ? ` · ${e.departmentName}` : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Other documents & policies</h2>
          <p className="text-xs text-muted-foreground">
            Create policies, choose audience (all / department / managers / group / person), save as
            draft or send by email, and track acceptance.
          </p>
        </div>
        <Button type="button" size="sm" className="cursor-pointer gap-1" onClick={openCreate}>
          <Plus className="size-3.5" />
          Create document
        </Button>
      </div>

      {rows.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No documents yet. Create a policy, pick who receives it, then Save or Send Mail.
        </section>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const stats = acceptanceStats(row);
            const files = row.attachments?.length ?? 0;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-border/70 bg-card p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {row.code} · {row.kind} · {row.status}
                      {files ? ` · ${files} file${files === 1 ? "" : "s"}` : ""}
                      {stats.total
                        ? ` · ${stats.accepted}/${stats.total} accepted · ${stats.pending} pending`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => openView(row)}
                    >
                      <Eye className="size-3" />
                      View
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      className="cursor-pointer"
                      onClick={() => openSend(row)}
                    >
                      <Send className="size-3" />
                      Send
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => openStatus(row)}
                      disabled={stats.total === 0}
                    >
                      <Users className="size-3" />
                      Status
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer text-destructive"
                      onClick={() => removeDoc(row)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SetupDrawer
        open={mode === "create" || mode === "edit" || mode === "view"}
        onClose={() => setMode(null)}
        title={drawerTitle}
        description={
          mode === "view"
            ? active?.code
            : "Add text and optional files. Save as draft, or Send Mail to the audience you select."
        }
        wide
        footer={
          mode === "view" ? (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={saveDoc}
              >
                {saving && !sendingMail ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                className="cursor-pointer gap-1"
                disabled={busy}
                onClick={() => void saveAndSendMail()}
              >
                <Send className="size-3.5" />
                {sendingMail
                  ? "Sending…"
                  : `Send Mail (${audienceRecipients.length})`}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-3">
          <SetupField label="Title" required>
            <SetupInput
              value={title}
              readOnly={readOnly}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Remote work policy"
            />
          </SetupField>
          <SetupField label="Type">
            <SetupSelect
              value={kind}
              disabled={readOnly}
              onChange={(e) => setKind(e.target.value as OrgDocKind)}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Content">
            <SetupTextarea
              value={body}
              readOnly={readOnly}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write the policy or document content…"
            />
          </SetupField>
          <SetupField
            label="Attachments"
            hint={`PDF, Office, images - max ${formatBytes(MAX_ORG_DOC_ATTACHMENT_BYTES)} each, up to ${MAX_ORG_DOC_ATTACHMENTS} files`}
          >
            {!readOnly ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground hover:bg-muted/40">
                <Paperclip className="size-4" />
                <span>Click to upload documents or images</span>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(e) => {
                    void onUploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
            {attachments.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">No attachments</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                      onClick={() => setPreviewFile(a)}
                    >
                      {a.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.dataUrl}
                          alt=""
                          className="size-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate font-medium">{a.fileName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(a.size)}
                      </span>
                    </button>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => removeAttachment(a.id)}
                        aria-label="Remove"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-medium text-primary"
                        onClick={() => setPreviewFile(a)}
                      >
                        Open
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SetupField>
          {!readOnly ? audiencePicker() : null}
        </div>
      </SetupDrawer>

      <SetupDrawer
        open={mode === "send"}
        onClose={() => setMode(null)}
        title="Send to employees"
        description={active ? `${active.code} · ${active.title}` : undefined}
        wide
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer gap-1"
              disabled={busy}
              onClick={() => void doSend()}
            >
              <Send className="size-3.5" />
              {sendingMail
                ? "Sending…"
                : `Send Mail (${audienceRecipients.length})`}
            </Button>
          </>
        }
      >
        {audiencePicker()}
      </SetupDrawer>

      <SetupDrawer
        open={mode === "status"}
        onClose={() => setMode(null)}
        title="Acceptance status"
        description={active ? `${active.code} · ${active.title}` : undefined}
        wide
        footer={
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
            Close
          </Button>
        }
      >
        {active ? (
          <ul className="erp-scroll max-h-[60vh] space-y-1.5 overflow-y-auto">
            {active.acceptances.length === 0 ? (
              <li className="py-8 text-center text-xs text-muted-foreground">Not sent yet</li>
            ) : (
              active.acceptances
                .slice()
                .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                .map((a) => (
                  <li
                    key={a.employeeId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.employeeName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.employeeCode}
                        {a.email ? ` · ${a.email}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        a.status === "accepted" && "bg-emerald-500/10 text-emerald-700",
                        a.status === "pending" && "bg-amber-500/10 text-amber-800",
                        a.status === "declined" && "bg-destructive/10 text-destructive",
                      )}
                    >
                      {a.status}
                    </span>
                  </li>
                ))
            )}
          </ul>
        ) : null}
      </SetupDrawer>

      {previewFile ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{previewFile.fileName}</p>
              <button
                type="button"
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewFile(null)}
              >
                Close
              </button>
            </div>
            <DocumentPreviewContent
              fileName={previewFile.fileName}
              dataUrl={previewFile.dataUrl}
              mimeType={previewFile.mimeType}
              frameClassName="max-h-[70vh]"
              viewOnly
            />
          </div>
        </div>
      ) : null}

      <SetupConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete document"
        message={confirmDelete ? `Delete “${confirmDelete.title}”?` : ""}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          deleteOrgDocument(confirmDelete.id);
          toast("Document deleted");
          setConfirmDelete(null);
          reload();
        }}
      />
    </div>
  );
}
