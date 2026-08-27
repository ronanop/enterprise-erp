"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Pencil, Plus, Trash2, X } from "lucide-react";

import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { readFileAsDataUrl } from "@/services/employee-management-service";
import { listEntityOptions, type SetupMasterOption } from "@/services/hr-setup-service";
import {
  deleteOnboardingPolicy,
  ensureOnboardingPoliciesLoaded,
  listOnboardingPolicies,
  policyEntityLabel,
  saveOnboardingPolicy,
  type OnboardingPolicyDoc,
  type OnboardingPolicyScope,
} from "@/services/onboarding-policies-service";

const MAX_POLICY_FILE_MB = 5;
const FILTER_ALL = "all";

export function OnboardingPoliciesPanel() {
  const [rows, setRows] = useState<OnboardingPolicyDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "create">("create");
  const [editing, setEditing] = useState<OnboardingPolicyDoc | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [scope, setScope] = useState<OnboardingPolicyScope>("all");
  const [entityId, setEntityId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [entities, setEntities] = useState<SetupMasterOption[]>([]);
  const [entityFilter, setEntityFilter] = useState(FILTER_ALL);

  const reload = useCallback(() => {
    setRows(listOnboardingPolicies(true));
  }, []);

  useEffect(() => {
    void ensureOnboardingPoliciesLoaded().then(reload);
    void listEntityOptions()
      .then(setEntities)
      .catch(() => setEntities([]));
  }, [reload]);

  const visibleRows = useMemo(() => {
    if (entityFilter === FILTER_ALL) return rows;
    return rows.filter((r) => r.scope === "entity" && r.entityId === entityFilter);
  }, [rows, entityFilter]);

  function resetForm(row?: OnboardingPolicyDoc | null) {
    setTitle(row?.title ?? "");
    setBody(row?.body ?? "");
    setFileName(row?.fileName ?? "");
    setFileDataUrl(row?.fileDataUrl ?? "");
    setMimeType(row?.mimeType ?? "");
    setSortOrder(String(row?.sortOrder ?? (rows.length || 0) + 1));
    setStatus(row?.status ?? "active");
    setScope(row?.scope === "entity" && row.entityId ? "entity" : "all");
    setEntityId(row?.entityId ?? "");
  }

  function openCreate() {
    setEditing(null);
    setMode("create");
    resetForm(null);
    setSortOrder(String((rows.length || 0) + 1));
    setScope("entity");
    if (entityFilter !== FILTER_ALL) {
      setEntityId(entityFilter);
    } else {
      setEntityId(entities[0]?.value ?? "");
    }
    setOpen(true);
  }

  function openView(row: OnboardingPolicyDoc) {
    setEditing(row);
    setMode("view");
    resetForm(row);
    setOpen(true);
  }

  function openEdit(row: OnboardingPolicyDoc) {
    setEditing(row);
    setMode("edit");
    resetForm(row);
    setOpen(true);
  }

  async function onPickPdf(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_POLICY_FILE_MB * 1024 * 1024) {
      toast(`File must be under ${MAX_POLICY_FILE_MB} MB`, "error");
      return;
    }
    const okType =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf") ||
      file.type.startsWith("image/");
    if (!okType) {
      toast("Upload a PDF (or image) for the policy document", "error");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFileName(file.name);
      setFileDataUrl(dataUrl);
      setMimeType(file.type || "application/pdf");
      toast("Policy file attached", "success");
    } catch {
      toast("Could not read file", "error");
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setFileName("");
    setFileDataUrl("");
    setMimeType("");
  }

  async function save() {
    if (!title.trim()) {
      toast("Title is required", "error");
      return;
    }
    if (!body.trim() && !fileDataUrl) {
      toast("Add written policy content or upload a PDF", "error");
      return;
    }
    const id = editing?.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    if (!entityId) {
      toast("Select an entity for this policy", "error");
      return;
    }
    const entity = entities.find((e) => e.value === entityId);
    try {
      await saveOnboardingPolicy({
        id,
        code: editing?.code ?? `POL-${id.slice(0, 6).toUpperCase()}`,
        title: title.trim(),
        body: body.trim(),
        fileName: fileDataUrl ? fileName : undefined,
        fileDataUrl: fileDataUrl || undefined,
        mimeType: fileDataUrl ? mimeType || "application/pdf" : undefined,
        scope: "entity",
        entityId,
        entityName: entity?.label || editing?.entityName,
        sortOrder: Number(sortOrder) || 0,
        status,
      });
      toast(editing && mode === "edit" ? "Policy updated" : "Policy added", "success");
      setOpen(false);
      reload();
    } catch {
      toast(
        "Could not save policy (storage full). Try a smaller PDF or clear browser site data.",
        "error",
      );
    }
  }

  async function remove(row: OnboardingPolicyDoc) {
    if (!window.confirm(`Delete “${row.title}”? Candidates will no longer see it.`)) return;
    try {
      await deleteOnboardingPolicy(row.id);
      toast("Policy deleted", "success");
      reload();
    } catch {
      toast("Could not delete policy", "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Onboarding Policies</h2>
        <div className="flex flex-nowrap items-center gap-2">
          <Button size="sm" className="cursor-pointer shrink-0" onClick={openCreate}>
            <Plus className="size-3.5" />
            Add policy
          </Button>
          <SetupSelect
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-8 min-w-[11rem] text-xs"
          >
            <option value={FILTER_ALL}>All policies</option>
            {entities.map((ent) => (
              <option key={ent.value} value={ent.value}>
                {ent.label}
              </option>
            ))}
          </SetupSelect>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No policies for this filter. Add a policy for an entity.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{row.sortOrder}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.title}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {row.fileName
                        ? `PDF: ${row.fileName}${row.body ? " · + written content" : ""}`
                        : row.body || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs">{policyEntityLabel(row)}</td>
                  <td className="px-3 py-2 text-xs capitalize">{row.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.updatedAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer px-2"
                        title="View"
                        onClick={() => openView(row)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer px-2"
                        title="Edit"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer px-2 text-destructive"
                        title="Delete"
                        onClick={() => remove(row)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SetupDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={
          mode === "view" ? "View policy" : mode === "edit" ? "Edit policy" : "Add policy"
        }
        description={
          mode === "view"
            ? "Preview of policy content shown on the onboarding portal."
            : "Provide written content, upload a PDF, or both — at least one is required. Select the entity this policy belongs to."
        }
        footer={
          mode === "view" ? (
            <>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  if (editing) openEdit(editing);
                }}
              >
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="cursor-pointer" disabled={uploading} onClick={save}>
                Save
              </Button>
            </>
          )
        }
      >
        <div className="space-y-3">
          <SetupField label="Entity" required hint="Synced from Org Setup → Entities.">
            <SetupSelect
              value={entityId}
              disabled={mode === "view"}
              onChange={(e) => {
                setScope("entity");
                setEntityId(e.target.value);
              }}
            >
              <option value="">Select entity…</option>
              {entities.map((ent) => (
                <option key={ent.value} value={ent.value}>
                  {ent.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Title" required>
            <SetupInput
              value={title}
              readOnly={mode === "view"}
              onChange={(e) => setTitle(e.target.value)}
            />
          </SetupField>
          <SetupField label="Sort order">
            <SetupInput
              type="number"
              value={sortOrder}
              readOnly={mode === "view"}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </SetupField>
          <SetupField label="Status">
            <SetupSelect
              value={status}
              disabled={mode === "view"}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SetupSelect>
          </SetupField>

          <SetupField
            label="Policy PDF"
            hint={`Optional upload · PDF preferred · max ${MAX_POLICY_FILE_MB} MB. Candidates open this when they click View.`}
          >
            {mode === "view" ? (
              fileDataUrl ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="size-3.5" />
                    {fileName || "Attached file"}
                  </p>
                  <DocumentPreviewContent
                    fileName={fileName || "policy.pdf"}
                    dataUrl={fileDataUrl}
                    mimeType={mimeType || "application/pdf"}
                    frameClassName="max-h-[40vh]"
                    viewOnly
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No PDF uploaded</p>
              )
            ) : (
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onPickPdf(file);
                    e.target.value = "";
                  }}
                />
                {fileName ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 text-xs">
                    <span className="min-w-0 truncate font-medium">{fileName}</span>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-destructive"
                      onClick={clearFile}
                    >
                      <X className="size-3.5" />
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </SetupField>

          <SetupField
            label="Policy content (written)"
            hint="Optional written text shown in the portal (use with or without a PDF)"
          >
            {mode === "view" ? (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                {body || "—"}
              </div>
            ) : (
              <SetupTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
            )}
          </SetupField>
        </div>
      </SetupDrawer>
    </div>
  );
}
