"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SquarePen,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import {
  formatAssignmentDate,
  formatAssignmentRegisterDcColumn,
  formatAssignmentStatus,
  isReturnedAssignment,
  resolveRegisterAssetCode,
  resolveRegisterAssetName,
  resolveRegisterAssignee,
  resolveRegisterBuilding,
  resolveRegisterDepartment,
  resolveRegisterEmployeeId,
  resolveRegisterLocation,
} from "@/components/assets/assignment-register-display";
import type { EmployeeLookup } from "@/components/assets/inventory/register-parity";
import { pickLinkedDcChallan } from "@/components/assets/dc-challan/dc-challan-document";

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
  listDepartmentOptions,
  listEmployeeDirectory,
  listEmployeeOptions,
  type EmployeeDirectoryEntry,
  type OrgOption,
} from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { listProjectOptions } from "@/services/projects-portal-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  buildAssignmentWizardHref,
  buildReturnWizardHref,
} from "@/components/assets/navigation/assignment-navigation";
import {
  buildDcChallanHref,
  canLaunchDcFromAssignment,
  isOpenDcChallanStatus,
} from "@/components/assets/navigation/dc-challan-navigation";
import {
  assetLocationService,
  dcChallanService,
  type AssetLocationRow,
  type DcChallanRow,
} from "@/services/assets-service";
import {
  listSiteBuildings,
  listSiteLocations,
} from "@/services/asset-site-location-service";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  department_id?: string | null;
  custodian_employee_id?: string | null;
  current_location_label?: string | null;
  status: string;
};

type AssignmentRow = {
  id: string;
  document_number: string;
  asset_id: string;
  allocation_type: string;
  employee_id?: string | null;
  employee_source?: string | null;
  manual_employee_name?: string | null;
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
  delivery_reference_number?: string | null;
  delivery_reference_status?: string | null;
  delivery_challan_signature_status?: string | null;
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
};

/** Register filter — lifecycle assignment status only (never workflow labels). */
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
] as const;
const ALLOCATION_TYPES = ["employee", "department", "project", "branch", "warehouse"] as const;

/**
 * STATUS column label for the assignment register table.
 * Uses assignment lifecycle `status` only — never `workflow_status`.
 * If a composite sneaks into `status` (e.g. "active / approved"), take the lifecycle token only.
 */
function registerStatusLabel(status: string | null | undefined): string {
  const lifecycle = (status ?? "").split("/")[0]?.trim() ?? "";
  return formatAssignmentStatus(lifecycle);
}

const EMPTY_FORM: AssignmentFormState = {
  asset_id: "",
  branch_id: "",
  allocation_type: "employee",
  employee_id: "",
  department_id: "",
  project_id: "",
};

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function formatDcCell(
  row: AssignmentRow,
  dc: DcChallanRow | null | undefined,
): string {
  return formatAssignmentRegisterDcColumn({
    delivery_reference_number: row.delivery_reference_number,
    delivery_reference_status: row.delivery_reference_status,
    delivery_challan_signature_status: row.delivery_challan_signature_status,
    hasDcRecord: Boolean(dc),
    dcChallanStatus: dc?.status,
  });
}

async function fetchLinkedDcByAssignmentId(
  items: AssignmentRow[],
): Promise<Record<string, DcChallanRow | null>> {
  const map: Record<string, DcChallanRow | null> = {};
  await Promise.all(
    items.map(async (row) => {
      try {
        const res = await dcChallanService.search({
          assignment_id: row.id,
          page: 1,
          page_size: 10,
        });
        map[row.id] = pickLinkedDcChallan(res.items ?? []);
      } catch {
        map[row.id] = null;
      }
    }),
  );
  return map;
}

async function fetchCurrentAssetLocations(): Promise<Record<string, AssetLocationRow>> {
  const byAsset: Record<string, AssetLocationRow> = {};
  let pageNum = 1;
  let totalCount = 0;
  const pageSize = 200;
  do {
    const res = await assetLocationService.search({
      page: pageNum,
      page_size: pageSize,
      is_current: true,
      status: "active",
    });
    totalCount = res.total;
    for (const loc of res.items) {
      if (loc.asset_id) byAsset[String(loc.asset_id)] = loc;
    }
    if (res.items.length === 0) break;
    pageNum += 1;
  } while ((pageNum - 1) * pageSize < totalCount);
  return byAsset;
}

function directoryToEmployeeLookup(
  directory: EmployeeDirectoryEntry[],
): EmployeeLookup {
  const out: EmployeeLookup = {};
  for (const entry of directory) {
    out[entry.id] = {
      label: entry.label,
      displayName: entry.displayName,
      employeeCode: entry.employeeCode,
      mobile: entry.mobile,
    };
  }
  return out;
}

const REGISTER_COL_COUNT = 9;

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
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [projects, setProjects] = useState<OrgOption[]>([]);
  const [locationByAssetId, setLocationByAssetId] = useState<Record<string, AssetLocationRow>>({});
  const [siteLocationLabels, setSiteLocationLabels] = useState<Record<string, string>>({});
  const [buildingLabels, setBuildingLabels] = useState<Record<string, string>>({});
  const [dcByAssignmentId, setDcByAssignmentId] = useState<Record<string, DcChallanRow | null>>(
    {},
  );
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
  const [hasOpenDc, setHasOpenDc] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const departmentLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const d of departments) labels[d.id] = d.label;
    return labels;
  }, [departments]);
  const projectLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const p of projects) labels[p.id] = p.label;
    return labels;
  }, [projects]);
  const employeeLookup = useMemo(
    () => directoryToEmployeeLookup(employeeDirectory),
    [employeeDirectory],
  );
  const employeeDeptById = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const e of employeeDirectory) map[e.id] = e.departmentId;
    return map;
  }, [employeeDirectory]);

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
    const [emp, directory, dept, proj, locations, buildings] = await Promise.all([
      listEmployeeOptions(),
      listEmployeeDirectory().catch(() => [] as EmployeeDirectoryEntry[]),
      listDepartmentOptions(),
      listProjectOptions().catch(() => [] as OrgOption[]),
      listSiteLocations().catch(() => []),
      listSiteBuildings().catch(() => []),
    ]);
    setEmployees(emp);
    setEmployeeDirectory(directory);
    setDepartments(dept);
    setProjects(proj);
    const siteLabels: Record<string, string> = {};
    for (const loc of locations) siteLabels[loc.id] = loc.name;
    setSiteLocationLabels(siteLabels);
    const bldLabels: Record<string, string> = {};
    for (const b of buildings) bldLabels[b.id] = b.name;
    setBuildingLabels(bldLabels);
  }, []);

  // Locations loaded separately so Promise.all typing stays clear
  const loadLocations = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      setLocationByAssetId(await fetchCurrentAssetLocations());
    } catch {
      setLocationByAssetId({});
    }
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

  const ensureAssetsForRows = useCallback(
    async (items: AssignmentRow[]) => {
      const ids = [
        ...new Set(items.map((row) => row.asset_id).filter((id): id is string => Boolean(id))),
      ];
      if (ids.length === 0) return;

      let known = new Set<string>();
      setAssetOptions((prev) => {
        known = new Set(prev.map((a) => a.id));
        return prev;
      });

      const missing = ids.filter((id) => !known.has(id));
      if (missing.length === 0) return;

      const fetched: AssetRow[] = [];
      await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await resourceService.get<AssetRow>(assetsPath, id);
            if (res.data) fetched.push(res.data as AssetRow);
          } catch {
            /* leave unresolved */
          }
        }),
      );
      if (fetched.length === 0) return;
      setAssetOptions((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const next = [...prev];
        for (const asset of fetched) {
          if (!seen.has(asset.id)) {
            seen.add(asset.id);
            next.push(asset);
          }
        }
        return next;
      });
    },
    [assetsPath],
  );

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
      let items: AssignmentRow[] = [];
      if (payload && typeof payload === "object" && "items" in payload) {
        items = payload.items ?? [];
        setRows(items);
        setTotal(payload.total ?? 0);
      } else if (Array.isArray(payload)) {
        items = payload;
        setRows(payload);
        setTotal(payload.length);
      } else {
        setRows([]);
        setTotal(0);
      }
      void ensureAssetsForRows(items);
      try {
        setDcByAssignmentId(await fetchLinkedDcByAssignmentId(items));
      } catch {
        setDcByAssignmentId({});
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load assignments");
      setRows([]);
      setTotal(0);
      setDcByAssignmentId({});
    } finally {
      setLoading(false);
    }
  }, [
    allocationTypeFilter,
    apiPath,
    ensureAssetsForRows,
    page,
    pageSize,
    search,
    statusFilter,
  ]);

  useEffect(() => {
    void loadLookups();
    void loadAssets();
    void loadLocations();
  }, [loadAssets, loadLocations, loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  function assigneeSummary(row: AssignmentRow): string {
    return resolveRegisterAssignee(row, employeeLookup, departmentLabels, projectLabels);
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
    });
    setModalMode("create");
  }

  // Retained for create-modal path (legacy); primary create uses the wizard.
  void openCreate;

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
    setDeleteConfirmOpen(false);
    setModalRow(row);
    setWorkflowComments("");
    setModalMode("view");
  }

  useEffect(() => {
    if (!modalRow || modalMode !== "view" || !canLaunchDcFromAssignment(modalRow)) {
      setHasOpenDc(false);
      return;
    }
    let cancelled = false;
    void dcChallanService
      .search({ assignment_id: modalRow.id, page: 1, page_size: 10 })
      .then((res) => {
        if (cancelled) return;
        setHasOpenDc((res.items ?? []).some((row) => isOpenDcChallanStatus(row.status)));
      })
      .catch(() => {
        if (!cancelled) setHasOpenDc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalRow, modalMode]);

  function openEdit(row: AssignmentRow) {
    if (row.status !== "draft") {
      setError("Only draft assignments can be edited.");
      return;
    }
    setError(null);
    // Existing assignment edit flow: resume draft in the assignment wizard
    router.push(buildAssignmentWizardHref({ draftId: row.id, assetId: row.asset_id }));
  }

  function closeModal() {
    if (actionLoading) return;
    setModalMode(null);
    setModalRow(null);
    setError(null);
    setForm(EMPTY_FORM);
    setDeleteConfirmOpen(false);
  }

  async function confirmDeleteAssignment() {
    if (!modalRow) return;
    setActionLoading(true);
    setError(null);
    try {
      // Existing assignment cancel — does not soft-delete or touch the asset.
      await resourceService.action(apiPath, modalRow.id, "cancel");
      setDeleteConfirmOpen(false);
      setModalMode(null);
      setModalRow(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete assignment");
    } finally {
      setActionLoading(false);
    }
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

  const statusBadge = (row: AssignmentRow) => {
    const label = registerStatusLabel(row.status);
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        data-testid="assignment-status-badge"
        data-render-source="AssetAssignmentWorkspace"
        data-status-display={label}
        data-raw-status={row.status ?? ""}
      >
        {label}
      </Badge>
    );
  };

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
        description="Register of assigned assets — assignee, location, status, and DC Challan."
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
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">Assigned assets</CardTitle>
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
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "__all"}
                    value={opt.value || "__all"}
                    className="cursor-pointer"
                  >
                    {opt.label}
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
            <table
              className="min-w-[68rem] w-full text-sm"
              data-testid="assignment-register-table"
              data-render-source="AssetAssignmentWorkspace"
            >
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className={tableSerialHeaderClassName()} scope="col">
                    {TABLE_SERIAL_HEADER_LABEL}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Asset
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Assignee
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Employee ID
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Location
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Building
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Assignment Date
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="min-w-[13.5rem] whitespace-nowrap px-4 py-2 font-medium"
                  >
                    DC Challan
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-muted-foreground"
                      colSpan={REGISTER_COL_COUNT}
                    >
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-muted-foreground"
                      colSpan={REGISTER_COL_COUNT}
                    >
                      No assignments found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const asset = assetMap.get(row.asset_id);
                    const location = locationByAssetId[row.asset_id];
                    const assignee = assigneeSummary(row);
                    const returned = isReturnedAssignment(row);
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t transition-colors duration-150 hover:bg-muted/40"
                        data-testid={`assignment-row-${row.id}`}
                        data-assignment-status={row.status}
                        data-returned={returned ? "true" : "false"}
                        onClick={() => openView(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openView(row);
                          }
                        }}
                        tabIndex={0}
                      >
                        <td className={tableSerialCellClassName()}>
                          {tableRowSerial(page, pageSize, index)}
                        </td>
                        <td className="px-3 py-2" data-testid="assignment-asset-cell">
                          <div className="font-medium">
                            {resolveRegisterAssetName(asset, row.asset_id)}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {resolveRegisterAssetCode(asset)}
                          </div>
                        </td>
                        <td
                          className="px-3 py-2"
                          data-testid="assignment-assignee-cell"
                          data-historical={returned ? "true" : undefined}
                        >
                          {assignee}
                        </td>
                        <td
                          className="px-3 py-2 font-mono text-xs"
                          data-testid="assignment-employee-id-cell"
                        >
                          {resolveRegisterEmployeeId(row, employeeLookup)}
                        </td>
                        <td className="px-3 py-2" data-testid="assignment-location-cell">
                          {resolveRegisterLocation(asset, location, siteLocationLabels)}
                        </td>
                        <td className="px-3 py-2" data-testid="assignment-building-cell">
                          {resolveRegisterBuilding(location, buildingLabels)}
                        </td>
                        <td
                          className="px-3 py-2 font-mono text-xs"
                          data-testid="assignment-date-cell"
                        >
                          {formatAssignmentDate(row.allocated_at)}
                        </td>
                        <td className="px-3 py-2" data-testid="assignment-status-cell">
                          {statusBadge(row)}
                        </td>
                        <td
                          className="min-w-[13.5rem] px-4 py-2 pr-5"
                          data-testid="assignment-dc-cell"
                        >
                          {(() => {
                            const linkedDc = dcByAssignmentId[row.id] ?? null;
                            const hasDc = Boolean(linkedDc);
                            const canLaunch = canLaunchDcFromAssignment(row);
                            const statusText = formatDcCell(row, linkedDc);
                            return (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <div
                                  className="shrink-0 text-xs leading-snug text-muted-foreground"
                                  data-testid="assignment-dc-status"
                                >
                                  {statusText}
                                </div>
                                {!hasDc && canLaunch ? (
                                  <button
                                    type="button"
                                    data-testid="assignment-dc-create"
                                    aria-label={`Create DC Challan for ${row.document_number}`}
                                    className={cn(
                                      buttonVariants({ variant: "outline", size: "sm" }),
                                      "h-7 shrink-0 cursor-pointer gap-1 px-2.5 text-xs transition-colors duration-200",
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(
                                        buildDcChallanHref({
                                          assetId: row.asset_id,
                                          assignmentId: row.id,
                                        }),
                                      );
                                    }}
                                  >
                                    <FileText className="size-3.5" aria-hidden />
                                    Create
                                  </button>
                                ) : null}
                                {hasDc && linkedDc ? (
                                  <button
                                    type="button"
                                    data-testid="assignment-dc-open"
                                    aria-label={`${
                                      isOpenDcChallanStatus(linkedDc.status) ? "Edit" : "View"
                                    } DC Challan for ${row.document_number}`}
                                    className={cn(
                                      buttonVariants({ variant: "ghost", size: "sm" }),
                                      "h-7 shrink-0 cursor-pointer gap-1 px-2.5 text-xs transition-colors duration-200",
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(
                                        buildDcChallanHref({
                                          challanId: linkedDc.id,
                                          assetId: row.asset_id,
                                          assignmentId: row.id,
                                        }),
                                      );
                                    }}
                                  >
                                    <FileText className="size-3.5" aria-hidden />
                                    {isOpenDcChallanStatus(linkedDc.status) ? "Edit" : "View"}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })()}
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
              <div className="mt-4 space-y-4" data-testid="assignment-detail-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {modalRow.document_number}
                    </p>
                    <p className="text-base font-semibold">Assignment details</p>
                  </div>
                  {statusBadge(modalRow)}
                </div>
                {(() => {
                  const asset = assetMap.get(modalRow.asset_id);
                  const location = locationByAssetId[modalRow.asset_id];
                  const empDept =
                    modalRow.employee_id != null
                      ? employeeDeptById[String(modalRow.employee_id)]
                      : null;
                  const linkedDc = dcByAssignmentId[modalRow.id] ?? null;
                  return (
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Asset</dt>
                        <dd data-testid="assignment-detail-asset">
                          {resolveRegisterAssetName(asset, modalRow.asset_id)}
                          {resolveRegisterAssetCode(asset) !== "—" ? (
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                              {resolveRegisterAssetCode(asset)}
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Assignee</dt>
                        <dd data-testid="assignment-detail-assignee">
                          {assigneeSummary(modalRow)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Employee ID</dt>
                        <dd
                          className="font-mono text-xs"
                          data-testid="assignment-detail-employee-id"
                        >
                          {resolveRegisterEmployeeId(modalRow, employeeLookup)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Department</dt>
                        <dd data-testid="assignment-detail-department">
                          {resolveRegisterDepartment(
                            modalRow,
                            asset,
                            empDept,
                            departmentLabels,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Location</dt>
                        <dd data-testid="assignment-detail-location">
                          {resolveRegisterLocation(asset, location, siteLocationLabels)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Building</dt>
                        <dd data-testid="assignment-detail-building">
                          {resolveRegisterBuilding(location, buildingLabels)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Assignment Date</dt>
                        <dd data-testid="assignment-detail-date">
                          {formatAssignmentDate(modalRow.allocated_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Status</dt>
                        <dd data-testid="assignment-detail-status">
                          {registerStatusLabel(modalRow.status)}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">DC Challan</dt>
                        <dd data-testid="assignment-detail-dc-status">
                          {formatDcCell(modalRow, linkedDc)}
                        </dd>
                      </div>
                    </dl>
                  );
                })()}
                <div
                  className="rounded-md border border-border/70 bg-muted/20 px-3 py-3"
                  data-testid="assignment-detail-dc"
                >
                  <p className="mb-2 text-sm font-medium text-foreground">Delivery Challan</p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">DC Number</dt>
                      <dd>{modalRow.delivery_reference_number?.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd className="capitalize">
                        {(modalRow.delivery_reference_status || "—").replaceAll("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Signature</dt>
                      <dd className="capitalize">
                        {(modalRow.delivery_challan_signature_status || "not_signed").replaceAll(
                          "_",
                          " ",
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
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
                  {canLaunchDcFromAssignment(modalRow) && !hasOpenDc ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      onClick={() =>
                        router.push(
                          buildDcChallanHref({
                            assetId: modalRow.asset_id,
                            assignmentId: modalRow.id,
                          }),
                        )
                      }
                    >
                      Create DC Challan
                    </Button>
                  ) : null}
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
                <div
                  className="flex flex-wrap gap-2 border-t border-border/70 pt-3"
                  data-testid="assignment-detail-actions"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    data-testid="assignment-detail-edit"
                    disabled={actionLoading}
                    onClick={() => openEdit(modalRow)}
                  >
                    <SquarePen className="mr-1 size-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    data-testid="assignment-detail-delete"
                    disabled={actionLoading}
                    onClick={() => {
                      setError(null);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="mr-1 size-4" />
                    Delete
                  </Button>
                </div>
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

      {deleteConfirmOpen && modalRow ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setDeleteConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-assignment-title"
            aria-describedby="delete-assignment-desc"
            data-testid="delete-assignment-confirm-dialog"
            className="w-full max-w-md rounded-md border border-border bg-background p-4 shadow-lg"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !actionLoading) setDeleteConfirmOpen(false);
            }}
          >
            <h2 id="delete-assignment-title" className="text-base font-semibold text-foreground">
              Delete assignment?
            </h2>
            <p
              id="delete-assignment-desc"
              className="mt-3 text-sm text-foreground"
              data-testid="delete-assignment-confirm-message"
            >
              Are you sure you want to delete this assignment?
            </p>
            {error ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                data-testid="delete-assignment-cancel"
                disabled={actionLoading}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer transition-colors duration-200"
                data-testid="delete-assignment-confirm"
                disabled={actionLoading}
                onClick={() => void confirmDeleteAssignment()}
              >
                {actionLoading ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
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
    </div>
  );
}
