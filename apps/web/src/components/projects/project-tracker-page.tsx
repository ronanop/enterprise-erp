"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, RefreshCw, Table2, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  emptyTrackerGrid,
  TrackerGridEditor,
} from "@/components/projects/tracker-grid-editor";
import { ProjectsErrorBanner, ProjectsListPanel, ProjectsPage } from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/services/api-client";
import {
  createCustomerTrackerGrid,
  downloadCustomerTracker,
  getCustomerTrackerGrid,
  listCustomerTrackers,
  listProjects,
  type CustomerTracker,
  type Project,
  type TrackerGrid,
} from "@/services/projects-portal-service";

type EditorMode = "closed" | "create" | "revise";

export function ProjectTrackerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [trackers, setTrackers] = useState<CustomerTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [mode, setMode] = useState<EditorMode>("closed");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [remarks, setRemarks] = useState("");
  const [grid, setGrid] = useState<TrackerGrid>(() => emptyTrackerGrid());
  const [baseVersion, setBaseVersion] = useState<number | null>(null);

  const projectLabels = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          `${project.project_code} · ${project.project_name}`,
        ]),
      ),
    [projects],
  );

  const resetEditor = useCallback(() => {
    setProjectId("");
    setTitle("");
    setRemarks("");
    setGrid(emptyTrackerGrid());
    setBaseVersion(null);
    setFormError(null);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setMode("closed");
    resetEditor();
  }, [resetEditor, saving]);

  const openCreate = useCallback(() => {
    resetEditor();
    setMode("create");
  }, [resetEditor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRows, trackerRows] = await Promise.all([
        listProjects(),
        listCustomerTrackers(),
      ]);
      setProjects(projectRows);
      setTrackers(trackerRows);
    } catch (err) {
      setError(formatApiError(err, "Unable to load customer trackers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openRevise(tracker: CustomerTracker) {
    setFormError(null);
    setSaving(true);
    try {
      if (tracker.is_grid === false) {
        setFormError("This version was an uploaded file. Download it, or create a new table.");
        setSaving(false);
        return;
      }
      const detail = await getCustomerTrackerGrid(tracker.id);
      setProjectId(detail.project_id);
      setTitle(detail.title || "");
      setRemarks(detail.remarks || "");
      setGrid(detail.grid);
      setBaseVersion(detail.version_no);
      setMode("revise");
    } catch (err) {
      setError(formatApiError(err, "Unable to open tracker table"));
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    if (!projectId) {
      setFormError("Select a project.");
      return;
    }
    if (!grid.columns.some((c) => c.label.trim())) {
      setFormError("Add at least one named column.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const normalized: TrackerGrid = {
        columns: grid.columns.map((c) => ({
          id: c.id,
          label: c.label.trim() || c.id,
        })),
        rows: grid.rows,
      };
      await createCustomerTrackerGrid({
        project_id: projectId,
        title: title.trim() || undefined,
        remarks: remarks.trim() || undefined,
        grid: normalized,
      });
      setMode("closed");
      resetEditor();
      await load();
    } catch (err) {
      setFormError(formatApiError(err, "Unable to save tracker table"));
    } finally {
      setSaving(false);
    }
  }

  const editorOpen = mode !== "closed";

  return (
    <ProjectsPage>
      <PageHeader
        title="Tracker"
        description="Build an Excel-like tracker table per project. Each save keeps a new version."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading || saving}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
              onClick={openCreate}
              disabled={saving}
            >
              <Plus className="size-3.5" /> New Tracker
            </Button>
          </div>
        }
      />
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      {editorOpen ? (
        <ProjectsListPanel>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Table2 className="size-4 text-muted-foreground" aria-hidden />
                {mode === "revise"
                  ? `Revise table (from v${baseVersion ?? "?"})`
                  : "Create tracker table"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add columns and rows like a spreadsheet, then save a version for the
                selected project.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="cursor-pointer transition-colors duration-200"
              disabled={saving}
              onClick={closeEditor}
            >
              <X className="size-3.5" /> Close
            </Button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="tracker-project" className="text-sm font-medium">
                  Project
                </label>
                <select
                  id="tracker-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={saving || mode === "revise"}
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
                <label htmlFor="tracker-title" className="text-sm font-medium">
                  Sheet title
                </label>
                <Input
                  id="tracker-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Site readiness tracker"
                  className="h-9"
                  disabled={saving}
                />
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
                placeholder="Note what changed in this version…"
                className="min-h-16"
                disabled={saving}
              />
            </div>

            <TrackerGridEditor value={grid} onChange={setGrid} disabled={saving} />

            {formError ? (
              <p className="text-xs text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={saving}
                onClick={closeEditor}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
                disabled={saving || !projectId}
                onClick={() => void onSave()}
              >
                {saving ? "Saving…" : "Save version"}
              </Button>
            </div>
          </div>
        </ProjectsListPanel>
      ) : null}

      <ProjectsListPanel>
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold">Tracker history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open a table version to revise it (saves as the next version), or download
            the stored sheet.
          </p>
        </div>
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Sheet</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Remarks</th>
                <th className="px-4 py-2.5 font-medium">Saved</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((tracker) => {
                const isGrid = tracker.is_grid !== false;
                return (
                  <tr key={tracker.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {projectLabels.get(tracker.project_id) ?? tracker.project_id}
                    </td>
                    <td className="px-4 py-2.5">v{tracker.version_no}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {tracker.file_name.replace(/\.tracker\.json$/i, "").replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isGrid
                          ? `${tracker.column_count ?? "—"} col · ${tracker.row_count ?? "—"} row`
                          : "Uploaded file"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {tracker.file_size < 1024 * 1024
                        ? `${Math.ceil(tracker.file_size / 1024)} KB`
                        : `${(tracker.file_size / (1024 * 1024)).toFixed(1)} MB`}
                    </td>
                    <td className="max-w-70 px-4 py-2.5 text-muted-foreground">
                      {tracker.remarks || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {tracker.created_at
                        ? new Date(tracker.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {isGrid ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer transition-colors duration-200"
                            disabled={saving}
                            onClick={() => void openRevise(tracker)}
                          >
                            <Pencil className="size-3.5" /> Open
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer transition-colors duration-200"
                          onClick={() => void downloadCustomerTracker(tracker)}
                        >
                          <Download className="size-3.5" /> Download
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && trackers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tracker tables yet. Use New Tracker to build the first sheet.
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading tracker history…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ProjectsListPanel>
    </ProjectsPage>
  );
}
