"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Paperclip, Plus, RefreshCw, X } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsErrorBanner, ProjectsListPanel, ProjectsPage } from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/services/api-client";
import {
  createCustomerTracker,
  downloadCustomerTracker,
  listCustomerTrackers,
  listProjects,
  type CustomerTracker,
  type Project,
} from "@/services/projects-portal-service";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectTrackerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trackers, setTrackers] = useState<CustomerTracker[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const projectLabels = useMemo(
    () => new Map(projects.map((project) => [project.id, `${project.project_code} · ${project.project_name}`])),
    [projects],
  );

  const clearFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const resetForm = useCallback(() => {
    setProjectId("");
    setRemarks("");
    setFormError(null);
    clearFile();
  }, [clearFile]);

  const closeDialog = useCallback(() => {
    if (uploading) return;
    setDialogOpen(false);
    resetForm();
  }, [resetForm, uploading]);

  const openDialog = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRows, trackerRows] = await Promise.all([listProjects(), listCustomerTrackers()]);
      setProjects(projectRows);
      setTrackers(trackerRows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to load customer trackers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onUpload() {
    if (!projectId || !file) {
      setFormError("Select a project and tracker file.");
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      await createCustomerTracker({
        project_id: projectId,
        file_name: file.name,
        content_base64: await fileToBase64(file),
        content_type: file.type || undefined,
        remarks: remarks.trim() || undefined,
      });
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Unable to upload tracker");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ProjectsPage>
      <PageHeader
        title="Tracker"
        description="Upload the tracker sent to a customer and retain each project version."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
              onClick={openDialog}
            >
              <Plus className="size-3.5" /> New Tracker
            </Button>
          </div>
        }
      />
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <ProjectsListPanel>
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold">Tracker history</h2>
        </div>
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">File</th>
                <th className="px-4 py-2.5 font-medium">Remarks</th>
                <th className="px-4 py-2.5 font-medium">Uploaded</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((tracker) => (
                <tr key={tracker.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {projectLabels.get(tracker.project_id) ?? tracker.project_id}
                  </td>
                  <td className="px-4 py-2.5">v{tracker.version_no}</td>
                  <td className="px-4 py-2.5">
                    <p>{tracker.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(tracker.file_size)}</p>
                  </td>
                  <td className="max-w-70 px-4 py-2.5 text-muted-foreground">{tracker.remarks || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {tracker.created_at ? new Date(tracker.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      onClick={() => void downloadCustomerTracker(tracker)}
                    >
                      <Download className="size-3.5" /> Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && trackers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tracker uploads yet. Use New Tracker to add the first version.
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading tracker history…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ProjectsListPanel>

      <ConfirmDialog
        open={dialogOpen}
        title="New Tracker"
        description="Upload the tracker sent to a customer. Each upload is kept as a new version for its project."
        confirmLabel="Upload tracker"
        cancelLabel="Cancel"
        busy={uploading}
        confirmDisabled={!projectId || !file}
        contentClassName="max-w-xl"
        onCancel={closeDialog}
        onConfirm={() => void onUpload()}
      >
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="tracker-project" className="text-sm font-medium">
              Project
            </label>
            <select
              id="tracker-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={uploading}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_code} · {project.project_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Tracker file</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="customer-tracker-file"
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer transition-colors duration-200"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Choose file
              </Button>
              {file ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-foreground">
                  <span className="min-w-0 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    aria-label="Clear selected file"
                    className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                    disabled={uploading}
                    onClick={clearFile}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No file selected</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tracker-remarks" className="text-sm font-medium">
              Remarks <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="tracker-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add a note about this tracker version…"
              className="min-h-20"
              disabled={uploading}
            />
          </div>

          {formError ? (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </ProjectsPage>
  );
}
