"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { InventorySearchTypeahead } from "@/components/assets/inventory/inventory-search-typeahead";
import {
  canLaunchDcFromAssignment,
  isEmployeeAllocation,
} from "@/components/assets/navigation/dc-challan-navigation";
import { StatusBadge } from "@/components/assets/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listEmployeeDirectory } from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { isActiveAssignment } from "@/domain/asset-prd";
import { ApiClientError } from "@/services/api-client";
import {
  assetOperationsService,
  assetRegisterService,
  dcChallanService,
  type AssetsRow,
  type DcChallanRow,
} from "@/services/assets-service";

const DC_ELIGIBLE_OPERATIONAL_STATUSES = ["READY_TO_MOVE", "ASSIGNED"] as const;

type AssignmentOption = {
  id: string;
  documentNumber: string;
  allocationType: string;
  status: string;
  employeeId: string | null;
  employeeLabel: string | null;
};

export type DcChallanCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAssetId?: string;
  initialAssignmentId?: string;
  /** When true (deep link), skip pickers and show a read-only confirmation. */
  lockPrefill?: boolean;
  busy?: boolean;
  onCreated: (row: DcChallanRow) => void;
};

type AssetPreview = {
  id: string;
  assetCode: string;
  assetName: string;
  serialNumber: string;
  operationalStatus: string;
};

function toAssetPreview(row: AssetsRow): AssetPreview | null {
  const id = String(row.id ?? "");
  if (!id) return null;
  return {
    id,
    assetCode: String(row.asset_code ?? row.document_number ?? "—"),
    assetName: String(row.asset_name ?? "—"),
    serialNumber:
      typeof row.serial_number === "string" && row.serial_number.trim()
        ? row.serial_number
        : "—",
    operationalStatus: String(row.operational_status ?? ""),
  };
}

function assignmentFromRow(row: AssetsRow): AssignmentOption | null {
  const id = String(row.id ?? "");
  if (!id) return null;
  return {
    id,
    documentNumber: String(row.document_number ?? "—"),
    allocationType: String(row.allocation_type ?? ""),
    status: String(row.status ?? ""),
    employeeId: row.employee_id ? String(row.employee_id) : null,
    employeeLabel: null,
  };
}

export function DcChallanCreateDialog({
  open,
  onOpenChange,
  initialAssetId = "",
  initialAssignmentId = "",
  lockPrefill = false,
  busy = false,
  onCreated,
}: DcChallanCreateDialogProps) {
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState<AssetPreview | null>(null);
  const [assignment, setAssignment] = useState<AssignmentOption | null>(null);
  const [assignmentChoices, setAssignmentChoices] = useState<AssignmentOption[]>([]);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = Boolean(lockPrefill && initialAssetId);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQuery("");
    setAsset(null);
    setAssignment(null);
    setAssignmentChoices([]);
    if (!initialAssetId) return;

    let cancelled = false;
    setLoadingPrefill(true);
    void assetRegisterService
      .get(initialAssetId)
      .then((row) => {
        if (cancelled) return;
        setAsset(toAssetPreview(row));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Could not load the selected asset.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrefill(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialAssetId]);

  useEffect(() => {
    if (!open || !asset) {
      setAssignmentChoices([]);
      if (!asset) setAssignment(null);
      return;
    }

    let cancelled = false;
    setLoadingAssignments(true);
    void assetOperationsService
      .listAssignments({
        asset_id: asset.id,
        allocation_type: "employee",
        page: 1,
        page_size: 20,
      })
      .then(async (res) => {
        if (cancelled) return;
        const directory = await listEmployeeDirectory();
        const labels = Object.fromEntries(directory.map((entry) => [entry.id, entry.label]));
        const options = (res.items ?? [])
          .map(assignmentFromRow)
          .filter((row): row is AssignmentOption => row != null)
          .filter((row) =>
            canLaunchDcFromAssignment({
              allocation_type: row.allocationType,
              status: row.status,
            }),
          )
          .map((row) => ({
            ...row,
            employeeLabel: row.employeeId ? (labels[row.employeeId] ?? null) : null,
          }));
        if (cancelled) return;
        setAssignmentChoices(options);

        const preferred =
          (initialAssignmentId
            ? options.find((row) => row.id === initialAssignmentId)
            : undefined) ??
          options.find((row) => isActiveAssignment(row)) ??
          (options.length === 1 ? options[0] : undefined);

        if (initialAssignmentId && !preferred) {
          setAssignment({
            id: initialAssignmentId,
            documentNumber: "Assignment",
            allocationType: "employee",
            status: "",
            employeeId: null,
            employeeLabel: null,
          });
          return;
        }
        setAssignment(preferred ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setAssignmentChoices([]);
        if (initialAssignmentId) {
          setAssignment({
            id: initialAssignmentId,
            documentNumber: "Assignment",
            allocationType: "employee",
            status: "",
            employeeId: null,
            employeeLabel: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, asset, initialAssignmentId]);

  const submit = async () => {
    if (!asset) {
      setError("Select an asset to create a DC challan.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const row = await dcChallanService.create({
        asset_id: asset.id,
        assignment_id: assignment?.id,
      });
      onCreated(row);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create DC challan");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const showAssignmentPicker = Boolean(asset) && assignmentChoices.length > 0 && !locked;
  const showLockedAssignment = locked && Boolean(assignment);
  const employeeLine =
    assignment?.employeeLabel ??
    (assignment && isEmployeeAllocation(assignment.allocationType)
      ? assignment.documentNumber
      : null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-labelledby="dc-create-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
        data-testid="dc-challan-create-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dc-create-title" className="text-sm font-medium">
          Create DC Challan
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Employee allocations only when linking an assignment. Case 2 (asset only) is allowed.
        </p>

        <div className="mt-4 space-y-4">
          {locked ? (
            <p className="text-xs text-muted-foreground">Confirm the asset from the inventory or assignment you opened.</p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="dc-create-asset-search">Asset</Label>
              <InventorySearchTypeahead
                value={query}
                onValueChange={(value) => {
                  setQuery(value);
                  if (asset && value !== asset.assetCode) {
                    setAsset(null);
                    setAssignment(null);
                    setAssignmentChoices([]);
                  }
                }}
                onSubmit={() => undefined}
                onSelectSuggestion={(suggestion) => {
                  setQuery(suggestion.assetCode);
                  setAsset({
                    id: suggestion.id,
                    assetCode: suggestion.assetCode,
                    assetName: suggestion.assetName,
                    serialNumber: suggestion.serialNumber,
                    operationalStatus: suggestion.operationalStatus,
                  });
                }}
                operationalStatuses={DC_ELIGIBLE_OPERATIONAL_STATUSES}
                emptyMessage="No ready-to-move or assigned assets match"
                placeholder="Search tag, name, serial, make, or model…"
                searchAriaLabel="Search eligible assets"
              />
            </div>
          )}

          {loadingPrefill ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading selected asset…
            </p>
          ) : null}

          {asset ? (
            <div
              className="rounded-lg border border-border/80 bg-muted/30 px-3 py-3"
              data-testid="dc-challan-create-preview"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Confirm selection
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{asset.assetCode}</p>
                  <p className="text-sm font-medium">{asset.assetName}</p>
                  {asset.serialNumber !== "—" ? (
                    <p className="text-xs text-muted-foreground">S/N {asset.serialNumber}</p>
                  ) : null}
                </div>
                {asset.operationalStatus ? (
                  <StatusBadge kind="operational" status={asset.operationalStatus} />
                ) : null}
              </div>
              {employeeLine ? (
                <p className="mt-2 text-sm">
                  Link to current assignment: {employeeLine}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({assignment?.documentNumber})
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Asset only — no employee assignment will be linked.
                </p>
              )}
            </div>
          ) : null}

          {loadingAssignments && asset ? (
            <p className="text-xs text-muted-foreground">Checking current assignment…</p>
          ) : null}

          {showAssignmentPicker ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Current assignment</p>
              {assignmentChoices.map((row) => {
                const selected = assignment?.id === row.id;
                const label =
                  row.employeeLabel ?? `${row.documentNumber} · ${row.status || "assignment"}`;
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
                      selected
                        ? "border-sky-300 bg-sky-50 text-sky-950"
                        : "border-border/80 bg-background hover:bg-muted/50",
                    )}
                    onClick={() => setAssignment(selected ? null : row)}
                  >
                    <span>
                      <span className="block font-medium">
                        {selected ? "Link to current assignment: " : ""}
                        {label}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.documentNumber} · {row.status || "open"}
                      </span>
                    </span>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Click again to create without linking (Case 2).
              </p>
            </div>
          ) : null}

          {showLockedAssignment && !showAssignmentPicker && !employeeLine ? (
            <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
              Link to current assignment: {assignment?.documentNumber}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              disabled={busy || submitting || !asset}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
