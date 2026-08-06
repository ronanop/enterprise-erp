"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SquarePen,
  Undo2,
  Users,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAccessTokenUserId, isAuthenticated } from "@/lib/auth";
import {
  DEMO_EMPLOYEE_ROSTER_LABELS,
  listDepartmentOptions,
  listEmployeeOptions,
  type OrgOption,
} from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { listProjectOptions } from "@/services/projects-portal-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  buildAssignmentWizardHref,
  buildReturnWizardHref,
} from "@/components/assets/navigation/assignment-navigation";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  department_id?: string | null;
  custodian_employee_id?: string | null;
  status: string;
};

type AssignmentRow = {
  id: string;
  document_number: string;
  asset_id: string;
  allocation_type: string;
  employee_id?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  expected_return_at?: string | null;
  allocated_at?: string | null;
  returned_at?: string | null;
  workflow_status?: string | null;
  status: string;
  version: number;
  created_by?: string | null;
  branch_id: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

type ModalMode = "create" | "edit" | "view";

type AssignmentFormState = {
  asset_id: string;
  branch_id: string;
  allocation_type: string;
  employee_id: string;
  department_id: string;
  project_id: string;
  expected_return_at: string;
};

const STATUS_OPTIONS = ["", "draft", "submitted", "approved", "active", "returned", "cancelled"] as const;
const ALLOCATION_TYPES = ["employee", "department", "project", "branch", "warehouse"] as const;

const EMPTY_FORM: AssignmentFormState = {
  asset_id: "",
  branch_id: "",
  allocation_type: "employee",
  employee_id: "",
  department_id: "",
  project_id: "",
  expected_return_at: "",
};

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function optionLabel(map: Map<string, OrgOption>, id?: string | null): string {
  if (!id) return "—";
  return map.get(id)?.label ?? `${id.slice(0, 8)}…`;
}

export function AssetAssignmentWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillAssetId = searchParams.get("assetId") ?? "";
  const returnIntent = searchParams.get("intent") === "return";
  const apiPath = "/assets/asset-assignments";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [employees, setEmployees] = useState<OrgOption[]>([]);
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [projects, setProjects] = useState<OrgOption[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalRow, setModalRow] = useState<AssignmentRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [allocationTypeFilter, setAllocationTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowComments, setWorkflowComments] = useState("");
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const currentUserId = useMemo(() => getAccessTokenUserId(), []);

  const canWorkflowAct = useMemo(() => {
    if (!modalRow || modalRow.status !== "submitted") return false;
    if (modalRow.workflow_status && modalRow.workflow_status !== "in_progress") {
      return false;
    }
    return true;
  }, [modalRow]);

  const canApproveOrReject = useMemo(() => {
    if (!canWorkflowAct) return false;
    if (!currentUserId || !modalRow?.created_by) return true;
    return modalRow.created_by !== currentUserId;
  }, [canWorkflowAct, currentUserId, modalRow]);

  const loadLookups = useCallback(async () => {
    if (!isAuthenticated()) return;
    const [emp, dept, proj] = await Promise.all([
      listEmployeeOptions(),
      listDepartmentOptions(),
      listProjectOptions().catch(() => [] as OrgOption[]),
    ]);
    setEmployees(emp);
    setDepartments(dept);
    setProjects(proj);
  }, []);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      const maintenance = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=in_maintenance`,
      );
      const merged = [...parseListItems<AssetRow>(active.data), ...parseListItems<AssetRow>(maintenance.data)];
      const seen = new Set<string>();
      setAssetOptions(
        merged.filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          return true;
        }),
      );
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) query.set("status", statusFilter);
      if (allocationTypeFilter) query.set("allocation_type", allocationTypeFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<AssignmentRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<AssignmentRow> | AssignmentRow[];
      if (payload && typeof payload === "object" && "items" in payload) {
        setRows(payload.items ?? []);
        setTotal(payload.total ?? 0);
      } else if (Array.isArray(payload)) {
        setRows(payload);
        setTotal(payload.length);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load assignments");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [allocationTypeFilter, apiPath, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void loadLookups();
    void loadAssets();
  }, [loadAssets, loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  function assigneeSummary(row: AssignmentRow): string {
    if (row.allocation_type === "employee") {
      return optionLabel(employeeMap, row.employee_id);
    }
    if (row.allocation_type === "department") {
      return optionLabel(departmentMap, row.department_id);
    }
    if (row.allocation_type === "project") {
      return optionLabel(projectMap, row.project_id);
    }
    return row.allocation_type;
  }

  function openCreate(preset?: Partial<AssignmentFormState>) {
    setError(null);
    setModalRow(null);
    const asset = preset?.asset_id ? assetMap.get(preset.asset_id) : undefined;
    setForm({
      ...EMPTY_FORM,
      asset_id: preset?.asset_id ?? prefillAssetId ?? "",
      branch_id: preset?.branch_id ?? asset?.branch_id ?? "",
      employee_id: preset?.employee_id ?? "",
      allocation_type: preset?.allocation_type ?? "employee",
      department_id: preset?.department_id ?? "",
      project_id: preset?.project_id ?? "",
      expected_return_at: preset?.expected_return_at ?? "",
    });
    setModalMode("create");
  }

  useEffect(() => {
    if (!prefillAssetId) return;
    if (returnIntent) {
      router.replace(buildReturnWizardHref({ assetId: prefillAssetId }));
      return;
    }
    router.replace(buildAssignmentWizardHref({ assetId: prefillAssetId }));
  }, [prefillAssetId, returnIntent, router]);

  function openView(row: AssignmentRow) {
    setError(null);
    setModalRow(row);
    setWorkflowComments("");
    setModalMode("view");
  }

  function openEdit(row: AssignmentRow) {
    if (row.status !== "draft") {
      setError("Only draft assignments can be edited.");
      return;
    }
    setError(null);
    setModalRow(row);
    setForm({
      asset_id: row.asset_id,
      branch_id: row.branch_id,
      allocation_type: row.allocation_type,
      employee_id: row.employee_id ?? "",
      department_id: row.department_id ?? "",
      project_id: row.project_id ?? "",
      expected_return_at: row.expected_return_at?.slice(0, 10) ?? "",
    });
    setModalMode("edit");
  }

  function closeModal() {
    if (actionLoading) return;
    setModalMode(null);
    setModalRow(null);
    setError(null);
    setForm(EMPTY_FORM);
  }

  function onFormAssetChange(assetId: string) {
    const asset = assetMap.get(assetId);
    setForm((current) => ({
      ...current,
      asset_id: assetId,
      branch_id: asset?.branch_id ?? "",
    }));
  }

  function validateForm(payload: AssignmentFormState, creating: boolean): string | null {
    if (creating && !payload.asset_id) return "Select an asset to assign.";
    if (!payload.allocation_type) return "Select an allocation type.";
    if (payload.allocation_type === "employee" && !payload.employee_id.trim()) {
      return "Select an employee.";
    }
    if (payload.allocation_type === "department" && !payload.department_id.trim()) {
      return "Select a department.";
    }
    if (payload.allocation_type === "project" && !payload.project_id.trim()) {
      return "Select a project.";
    }
    return null;
  }

  async function refreshModalRow(rowId: string) {
    const fresh = await resourceService.get<AssignmentRow>(apiPath, rowId);
    const row = fresh.data as AssignmentRow;
    setModalRow(row);
    return row;
  }

  async function createDraft() {
    const validationError = validateForm(form, true);
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: form.asset_id,
        branch_id: form.branch_id,
        allocation_type: form.allocation_type,
        employee_id: form.allocation_type === "employee" ? form.employee_id || undefined : undefined,
        department_id:
          form.allocation_type === "department" ? form.department_id || undefined : undefined,
        project_id: form.allocation_type === "project" ? form.project_id || undefined : undefined,
        expected_return_at: form.expected_return_at || undefined,
      });
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create assignment");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!modalRow || modalRow.status !== "draft") {
      setError("Only draft assignments can be edited.");
      return;
    }
    const validationError = validateForm(form, false);
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, modalRow.id, {
        allocation_type: form.allocation_type,
        employee_id: form.allocation_type === "employee" ? form.employee_id || null : null,
        department_id: form.allocation_type === "department" ? form.department_id || null : null,
        project_id: form.allocation_type === "project" ? form.project_id || null : null,
        expected_return_at: form.expected_return_at || null,
        version: modalRow.version,
      });
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update assignment");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: string, body?: Record<string, unknown>) {
    if (!modalRow) return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.action(apiPath, modalRow.id, action, body);
      await load();
      const updated = await refreshModalRow(modalRow.id);
      if (action === "approve" || action === "reject" || action === "return") {
        setWorkflowComments("");
      }
      if (action === "return" || action === "cancel") {
        setModalRow(updated);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (row: AssignmentRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
      {row.workflow_status ? ` / ${row.workflow_status}` : ""}
    </Badge>
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const modalTitle =
    modalMode === "create"
      ? "New assignment"
      : modalMode === "edit"
        ? "Edit assignment"
        : modalMode === "view"
          ? "Assignment details"
          : "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset assignments"
        description="Allocate assets to employees, departments, projects, or branches with workflow approval and return."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading || actionLoading}
            >
              <RefreshCw className="mr-1 size-4" />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => router.push(buildAssignmentWizardHref({}))}
            >
              <Plus className="mr-1 size-4" />
              Add assignment
            </Button>
          </div>
        }
      />

      {error && !modalMode ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden />
            Team roster
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {employees.map((emp) => (
                <Button
                  key={emp.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => openCreate({ employee_id: emp.id, allocation_type: "employee" })}
                >
                  {emp.label}
                </Button>
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Load employees from Master Data to assign by name. Demo roster (after{" "}
                <span className="font-mono text-xs">seed_demo_modules</span>):
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_EMPLOYEE_ROSTER_LABELS.map((label) => (
                  <span
                    key={label}
                    className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">Assignments</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Search assignments"
              placeholder="Search document or asset"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter || "__all"}
              onValueChange={(value) => {
                setPage(1);
                setStatusFilter(value === "__all" ? "" : value);
              }}
            >
              <SelectTrigger className="w-40 cursor-pointer" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all" className="cursor-pointer">
                  All statuses
                </SelectItem>
                {STATUS_OPTIONS.filter(Boolean).map((status) => (
                  <SelectItem key={status} value={status} className="cursor-pointer">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={allocationTypeFilter || "__all"}
              onValueChange={(value) => {
                setPage(1);
                setAllocationTypeFilter(value === "__all" ? "" : value);
              }}
            >
              <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by allocation type">
                <SelectValue placeholder="Allocation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all" className="cursor-pointer">
                  All types
                </SelectItem>
                {ALLOCATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="cursor-pointer">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Document
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Asset
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Assignee
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                      No assignments found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const asset = assetMap.get(row.asset_id);
                    return (
                      <tr key={row.id} className="border-t transition-colors duration-150 hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                          <div className="text-xs text-muted-foreground">
                            {asset?.asset_code ?? "Unresolved asset"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{assigneeSummary(row)}</td>
                        <td className="px-3 py-2 text-xs capitalize">{row.allocation_type}</td>
                        <td className="px-3 py-2">{statusBadge(row)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="View"
                              aria-label={`View ${row.document_number}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "cursor-pointer",
                              )}
                              onClick={() => openView(row)}
                            >
                              <Eye className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              aria-label={`Edit ${row.document_number}`}
                              disabled={row.status !== "draft"}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                              )}
                              onClick={() => openEdit(row)}
                            >
                              <SquarePen className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {total} total · page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {modalMode ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:items-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          role="presentation"
          onClick={() => closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-modal-title"
            className="my-4 w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="assignment-modal-title" className="text-sm font-medium tracking-tight">
                {modalTitle}
              </h2>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "size-8 shrink-0 cursor-pointer",
                )}
                onClick={() => closeModal()}
                disabled={actionLoading}
              >
                <X className="size-4" />
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {modalMode === "view" && modalRow ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{modalRow.document_number}</p>
                    <p className="text-base font-semibold">
                      {assetMap.get(modalRow.asset_id)?.asset_name ?? modalRow.asset_id}
                    </p>
                  </div>
                  {statusBadge(modalRow)}
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Assignee</dt>
                    <dd>{assigneeSummary(modalRow)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Allocation type</dt>
                    <dd className="capitalize">{modalRow.allocation_type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Expected return</dt>
                    <dd>{modalRow.expected_return_at?.slice(0, 10) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Allocated</dt>
                    <dd>{modalRow.allocated_at?.slice(0, 10) ?? "—"}</dd>
                  </div>
                </dl>
                <div className="space-y-2">
                  <Label htmlFor="asn-workflow-comments">Workflow comments</Label>
                  <Input
                    id="asn-workflow-comments"
                    placeholder="Optional approval or rejection comments"
                    value={workflowComments}
                    onChange={(e) => setWorkflowComments(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={actionLoading || modalRow.status !== "draft"}
                    onClick={() => void runAction("submit")}
                  >
                    <Send className="mr-1 size-4" />
                    Submit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={actionLoading || modalRow.status !== "draft"}
                    onClick={() => void runAction("cancel")}
                  >
                    Cancel draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    disabled={actionLoading || !canApproveOrReject}
                    onClick={() =>
                      void runAction("approve", { comments: workflowComments || undefined })
                    }
                  >
                    <ShieldCheck className="mr-1 size-4" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={actionLoading || !canApproveOrReject}
                    onClick={() =>
                      void runAction("reject", { comments: workflowComments || undefined })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={actionLoading || modalRow.status !== "active"}
                    onClick={() => void runAction("return")}
                  >
                    <Undo2 className="mr-1 size-4" />
                    Return
                  </Button>
                </div>
                {modalRow.status === "draft" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => openEdit(modalRow)}
                  >
                    <SquarePen className="mr-1 size-4" />
                    Edit draft
                  </Button>
                ) : null}
              </div>
            ) : null}

            {modalMode === "create" || modalMode === "edit" ? (
              <AssignmentFormFields
                mode={modalMode}
                form={form}
                assetOptions={assetOptions}
                employees={employees}
                departments={departments}
                projects={projects}
                onAssetChange={onFormAssetChange}
                onChange={setForm}
              />
            ) : null}

            {modalMode === "create" || modalMode === "edit" ? (
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => closeModal()}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={actionLoading}
                  onClick={() => void (modalMode === "create" ? createDraft() : saveDraft())}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 size-4" />
                  )}
                  {modalMode === "create" ? "Create draft" : "Save changes"}
                </Button>
              </div>
            ) : null}

            {modalMode === "view" ? (
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => closeModal()}>
                  Close
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentFormFields({
  mode,
  form,
  assetOptions,
  employees,
  departments,
  projects,
  onAssetChange,
  onChange,
}: {
  mode: "create" | "edit";
  form: AssignmentFormState;
  assetOptions: AssetRow[];
  employees: OrgOption[];
  departments: OrgOption[];
  projects: OrgOption[];
  onAssetChange: (assetId: string) => void;
  onChange: Dispatch<SetStateAction<AssignmentFormState>>;
}) {
  return (
    <div className="mt-4 grid gap-3">
      {mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="asn-asset">Asset</Label>
          <Select value={form.asset_id || "__none"} onValueChange={(v) => onAssetChange(v === "__none" ? "" : v)}>
            <SelectTrigger id="asn-asset" className="cursor-pointer">
              <SelectValue placeholder="Select active asset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select asset…
              </SelectItem>
              {assetOptions.map((asset) => (
                <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                  {asset.asset_code} — {asset.asset_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="asn-branch">Branch</Label>
        <Input id="asn-branch" value={form.branch_id} readOnly className="font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="asn-type">Allocation type</Label>
        <Select
          value={form.allocation_type}
          onValueChange={(value) => onChange((s) => ({ ...s, allocation_type: value }))}
        >
          <SelectTrigger id="asn-type" className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALLOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="cursor-pointer">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.allocation_type === "employee" ? (
        <div className="space-y-2">
          <Label htmlFor="asn-emp">Employee</Label>
          {employees.length > 0 ? (
            <Select
              value={form.employee_id || "__none"}
              onValueChange={(v) => onChange((s) => ({ ...s, employee_id: v === "__none" ? "" : v }))}
            >
              <SelectTrigger id="asn-emp" className="cursor-pointer">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="cursor-pointer">
                  Select employee…
                </SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                    {emp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              No employees in Master Data. Run demo seed or add employees, then refresh.
            </p>
          )}
        </div>
      ) : null}

      {form.allocation_type === "department" ? (
        <div className="space-y-2">
          <Label htmlFor="asn-dept">Department</Label>
          <Select
            value={form.department_id || "__none"}
            onValueChange={(v) => onChange((s) => ({ ...s, department_id: v === "__none" ? "" : v }))}
          >
            <SelectTrigger id="asn-dept" className="cursor-pointer">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select department…
              </SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id} className="cursor-pointer">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {form.allocation_type === "project" ? (
        <div className="space-y-2">
          <Label htmlFor="asn-proj">Project</Label>
          <Select
            value={form.project_id || "__none"}
            onValueChange={(v) => onChange((s) => ({ ...s, project_id: v === "__none" ? "" : v }))}
          >
            <SelectTrigger id="asn-proj" className="cursor-pointer">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select project…
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="asn-return">Expected return</Label>
        <Input
          id="asn-return"
          type="date"
          value={form.expected_return_at}
          onChange={(e) => onChange((s) => ({ ...s, expected_return_at: e.target.value }))}
        />
      </div>
    </div>
  );
}
