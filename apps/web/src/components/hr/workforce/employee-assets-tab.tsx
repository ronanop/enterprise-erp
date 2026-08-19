"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PackagePlus, RotateCcw } from "lucide-react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  assignEmployeeAsset,
  formatAssetDate,
  isActiveAssignment,
  loadAvailableEmployeeAssets,
  loadEmployeeAssets,
  returnEmployeeAsset,
  type EmployeeAssetOption,
  type EmployeeAssetRecord,
} from "@/services/employee-assets-service";
import type { EmployeeRecord } from "@/types/employee-management";

export function EmployeeAssetsTab({ employee }: { employee: EmployeeRecord }) {
  const [rows, setRows] = useState<EmployeeAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [options, setOptions] = useState<EmployeeAssetOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [acting, setActing] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await loadEmployeeAssets(employee.id));
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load assets", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openAssign() {
    setAssignOpen(true);
    setAssetId("");
    setExpectedReturnAt("");
    setOptionsLoading(true);
    try {
      const available = await loadAvailableEmployeeAssets(
        employee.id,
        employee.branchId || undefined,
      );
      setOptions(available);
      if (!available.length) {
        toast("No unassigned assets available for this branch", "error");
      }
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load assets", "error");
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }

  async function handleAssign() {
    if (!assetId) {
      toast("Select an asset", "error");
      return;
    }
    if (!employee.branchId) {
      toast("Employee branch is required to assign assets", "error");
      return;
    }
    setActing(true);
    try {
      await assignEmployeeAsset({
        employeeId: employee.id,
        assetId,
        branchId: employee.branchId,
        expectedReturnAt: expectedReturnAt || undefined,
      });
      toast("Asset assigned", "success");
      setAssignOpen(false);
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Assign failed", "error");
    } finally {
      setActing(false);
    }
  }

  async function handleReturn(assignmentId: string) {
    const ok = window.confirm("Mark this asset as returned?");
    if (!ok) return;
    setReturningId(assignmentId);
    try {
      await returnEmployeeAsset(assignmentId);
      toast("Asset returned", "success");
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Return failed", "error");
    } finally {
      setReturningId(null);
    }
  }

  const activeCount = rows.filter((r) => isActiveAssignment(r.assignmentStatus)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Company assets</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Issue and track laptops, phones, and other equipment assigned to this employee.
          </p>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-semibold tabular-nums">{activeCount}</span> active assignment
            {activeCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => void load()}
          >
            <RotateCcw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={() => void openAssign()}>
            <PackagePlus className="size-3.5" />
            Assign asset
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading assets…</p>
      ) : !rows.length ? (
        <HrEmptyState
          title="No assets assigned"
          description="Assign company equipment from the asset register to track custody for this employee."
          action={
            <Button size="sm" className="cursor-pointer" onClick={() => void openAssign()}>
              Assign asset
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground">
                {[
                  "Asset",
                  "Code",
                  "Serial",
                  "Type",
                  "Assigned",
                  "Expected return",
                  "Status",
                  "Actions",
                ].map((col) => (
                  <th key={col} className="px-3 py-2 font-medium uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.id}-${row.assignmentId ?? "custodian"}`} className="border-b border-border/40">
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-medium text-foreground">{row.assetName}</div>
                    {row.documentNumber ? (
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {row.documentNumber}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono">{row.assetCode || "—"}</td>
                  <td className="px-3 py-2.5 align-top">{row.serialNumber || "—"}</td>
                  <td className="px-3 py-2.5 align-top capitalize">{row.assetType || "—"}</td>
                  <td className="px-3 py-2.5 align-top">{formatAssetDate(row.allocatedAt)}</td>
                  <td className="px-3 py-2.5 align-top">{formatAssetDate(row.expectedReturnAt)}</td>
                  <td className="px-3 py-2.5 align-top">
                    <HrStatusBadge status={row.assignmentStatus ?? row.assetStatus} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/assets/assets?highlight=${row.id}`}
                        className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border px-2 text-[11px] font-medium hover:bg-muted"
                      >
                        View
                      </Link>
                      {row.assignmentId && isActiveAssignment(row.assignmentStatus) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer px-2 text-[11px]"
                          disabled={returningId === row.assignmentId}
                          onClick={() => void handleReturn(row.assignmentId!)}
                        >
                          Return
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SetupDrawer
        open={assignOpen}
        title="Assign asset"
        description={`Issue equipment to ${employee.displayName} (${employee.employeeCode}).`}
        onClose={() => setAssignOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setAssignOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={acting || optionsLoading || !options.length}
              onClick={() => void handleAssign()}
            >
              Assign
            </Button>
          </div>
        }
      >
        {optionsLoading ? (
          <p className="text-xs text-muted-foreground">Loading available assets…</p>
        ) : !options.length ? (
          <p className="text-xs text-muted-foreground">
            No unassigned active assets found for this employee&apos;s branch. Add assets in the{" "}
            <Link href="/assets/assets" className="font-medium text-primary hover:underline">
              Asset register
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            <SetupField label="Asset" required>
              <SetupSelect
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                aria-label="Asset"
              >
                <option value="">Select asset…</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.assetCode} — {opt.assetName}
                    {opt.serialNumber ? ` (${opt.serialNumber})` : ""}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Expected return date" hint="Optional">
              <SetupInput
                type="date"
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
              />
            </SetupField>
          </div>
        )}
      </SetupDrawer>
    </div>
  );
}
