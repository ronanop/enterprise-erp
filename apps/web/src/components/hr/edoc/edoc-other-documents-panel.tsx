"use client";

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

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadEmployeeDirectory, readFileAsDataUrl } from "@/services/employee-management-service";
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
type SendTarget = "group" | "single";

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
  const [sendTarget, setSendTarget] = useState<SendTarget>("group");
  const [groupId, setGroupId] = useState("");
  const [singleId, setSingleId] = useState("");
  const [sendQuery, setSendQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState<OrgDocAttachment | null>(null);

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

  function openCreate() {
    setActive(null);
    setTitle("");
    setKind("policy");
    setBody("");
    setAttachments([]);
    setMode("create");
  }

  function openEdit(row: OrgDocument) {
    setActive(row);
    setTitle(row.title);
    setKind(row.kind);
    setBody(row.body);
    setAttachments(row.attachments ?? []);
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
    setSendTarget("group");
    setGroupId(groups[0]?.id ?? "");
    setSingleId("");
    setSendQuery("");
    const gid = groups[0]?.id ?? "";
    const members = employees.filter((e) => employeeGroupId(e) === gid);
    setSelectedIds(new Set(members.map((e) => e.id)));
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
          id: crypto.randomUUID(),
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

  function saveDoc() {
    if (!title.trim()) {
      toast("Title is required", "error");
      return;
    }
    if (!body.trim() && attachments.length === 0) {
      toast("Add content or at least one attachment", "error");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        createOrgDocument({ title, kind, body, attachments });
        toast("Document created");
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
    if (!window.confirm(`Delete “${row.title}”?`)) return;
    deleteOrgDocument(row.id);
    toast("Document deleted");
    reload();
  }

  function doSend() {
    if (!active) return;
    let recipients = employees.filter((e) => selectedIds.has(e.id));
    if (sendTarget === "single") {
      if (!singleId) {
        toast("Select an employee", "error");
        return;
      }
      recipients = employees.filter((e) => e.id === singleId);
    } else if (selectedIds.size === 0) {
      toast("Select at least one employee in the group", "error");
      return;
    }
    setSaving(true);
    try {
      sendOrgDocument(
        active.id,
        recipients.map((e) => ({
          employeeId: e.id,
          employeeCode: e.employeeCode || e.id.slice(0, 8),
          employeeName: e.displayName || e.employeeCode || "Employee",
          email: employeeEmail(e),
        })),
      );
      toast(
        `Sent to ${recipients.length} employee(s). They can accept under Employee Requests → Org docs.`,
      );
      setMode(null);
      reload();
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Other documents & policies</h2>
          <p className="text-xs text-muted-foreground">
            Create pages with optional file/image uploads, send to an employment group or a single
            person, and track acceptance in the PWA.
          </p>
        </div>
        <Button type="button" size="sm" className="cursor-pointer gap-1" onClick={openCreate}>
          <Plus className="size-3.5" />
          Create document
        </Button>
      </div>

      {rows.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No documents yet. Create a policy or page, then send it to employees.
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
            : "Add text and optional documents or images. Employees will see them when you send."
        }
        wide
        footer={
          mode === "view" ? (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="button" className="cursor-pointer" disabled={saving} onClick={saveDoc}>
                {saving ? "Saving…" : "Save"}
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
            hint={`PDF, Office, images — max ${formatBytes(MAX_ORG_DOC_ATTACHMENT_BYTES)} each, up to ${MAX_ORG_DOC_ATTACHMENTS} files`}
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
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="button" className="cursor-pointer gap-1" disabled={saving} onClick={doSend}>
              <Send className="size-3.5" />
              {saving
                ? "Sending…"
                : sendTarget === "single"
                  ? "Send to person"
                  : `Send (${selectedIds.size})`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <SetupField label="Send to">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium",
                  sendTarget === "group"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 hover:bg-muted/40",
                )}
                onClick={() => {
                  setSendTarget("group");
                  if (groupId) onPickGroup(groupId);
                }}
              >
                Employment group
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium",
                  sendTarget === "single"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 hover:bg-muted/40",
                )}
                onClick={() => {
                  setSendTarget("single");
                  setSelectedIds(new Set());
                }}
              >
                Single person
              </button>
            </div>
          </SetupField>

          {sendTarget === "group" ? (
            <>
              <SetupField label="Employment group" required>
                <SetupSelect
                  value={groupId}
                  onChange={(e) => onPickGroup(e.target.value)}
                >
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
                        onClick={() =>
                          setSelectedIds(new Set(groupMembers.map((e) => e.id)))
                        }
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
                  <ul className="erp-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                    {groupMembers.length === 0 ? (
                      <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                        No employees assigned to this group yet. Add people below.
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

                  <SetupField
                    label="Add employees to this send"
                    hint="Include people not yet in the group for this document only"
                  >
                    <Input
                      value={sendQuery}
                      onChange={(e) => setSendQuery(e.target.value)}
                      placeholder="Search employees to add…"
                      className="h-9"
                    />
                  </SetupField>
                  {sendQuery.trim() ? (
                    <ul className="erp-scroll max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                      {addableEmployees.length === 0 ? (
                        <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                          No matches
                        </li>
                      ) : (
                        addableEmployees.slice(0, 40).map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/40"
                              onClick={() =>
                                setSelectedIds((prev) => new Set(prev).add(e.id))
                              }
                            >
                              <span className="truncate font-medium">
                                {e.displayName || e.employeeCode}
                              </span>
                              <span className="shrink-0 text-[10px] text-primary">+ Add</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}

                  {selectedIds.size > groupMembers.length ? (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedIds.size - groupMembers.filter((e) => selectedIds.has(e.id)).length}{" "}
                      extra recipient(s) added outside the group.
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <SetupField label="Search employee">
                <Input
                  value={sendQuery}
                  onChange={(e) => setSendQuery(e.target.value)}
                  placeholder="Name, code, email…"
                  className="h-9"
                />
              </SetupField>
              <ul className="erp-scroll max-h-[50vh] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                {filteredSingles.length === 0 ? (
                  <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No employees found
                  </li>
                ) : (
                  filteredSingles.map((e) => {
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
                            name="single-employee"
                            className="cursor-pointer"
                            checked={selected}
                            onChange={() => setSingleId(e.id)}
                          />
                          <span className="min-w-0 truncate font-medium">
                            {e.displayName || e.employeeCode}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {e.employeeCode}
                            {employeeGroupId(e)
                              ? ` · ${groups.find((g) => g.id === employeeGroupId(e))?.group_name ?? "group"}`
                              : ""}
                          </span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          )}
        </div>
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
            {previewFile.mimeType.startsWith("image/") ||
            previewFile.dataUrl.startsWith("data:image") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewFile.dataUrl}
                alt={previewFile.fileName}
                className="max-h-[70vh] w-auto max-w-full rounded-md"
              />
            ) : (
              <iframe
                title={previewFile.fileName}
                src={previewFile.dataUrl}
                className="h-[70vh] w-full rounded-md border border-border"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
