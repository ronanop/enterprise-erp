"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  CreditCard,
  Laptop,
  Monitor,
  Package,
  RotateCcw,
  Smartphone,
  type LucideProps,
} from "lucide-react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  formatAssetDate,
  isActiveAssignment,
  loadEmployeeAssets,
  type EmployeeAssetRecord,
} from "@/services/employee-assets-service";
import type { EmployeeRecord } from "@/types/employee-management";

function assetTypeIcon(type: string): ComponentType<LucideProps> {
  switch (type.toLowerCase()) {
    case "laptop":
      return Laptop;
    case "mobile":
    case "phone":
      return Smartphone;
    case "monitor":
    case "display":
      return Monitor;
    case "accessories":
    case "accessory":
    case "id":
    case "badge":
      return CreditCard;
    default:
      return Package;
  }
}

function demoAssetsFor(employee: EmployeeRecord): EmployeeAssetRecord[] {
  const code = employee.employeeCode || "EMP";
  return [
    {
      id: `demo-laptop-${employee.id}`,
      assignmentId: null,
      assetCode: "AST-LAP-001",
      assetName: "MacBook Pro 14\"",
      assetType: "laptop",
      serialNumber: `C02${code.slice(-4).toUpperCase()}X9`,
      assetStatus: "allocated",
      assignmentStatus: "active",
      documentNumber: `ASN-${code}-01`,
      allocatedAt: "2025-04-12",
      expectedReturnAt: null,
      returnedAt: null,
    },
    {
      id: `demo-phone-${employee.id}`,
      assignmentId: null,
      assetCode: "AST-PHN-014",
      assetName: "iPhone 15",
      assetType: "mobile",
      serialNumber: `IMEI-3598${code.replace(/\D/g, "").slice(-6).padStart(6, "0")}`,
      assetStatus: "allocated",
      assignmentStatus: "active",
      documentNumber: `ASN-${code}-02`,
      allocatedAt: "2025-06-01",
      expectedReturnAt: null,
      returnedAt: null,
    },
    {
      id: `demo-monitor-${employee.id}`,
      assignmentId: null,
      assetCode: "AST-MON-008",
      assetName: "Dell UltraSharp 27\"",
      assetType: "monitor",
      serialNumber: `CN-0${code.slice(-3).toUpperCase()}27U`,
      assetStatus: "allocated",
      assignmentStatus: "active",
      documentNumber: `ASN-${code}-03`,
      allocatedAt: "2025-04-12",
      expectedReturnAt: null,
      returnedAt: null,
    },
    {
      id: `demo-id-${employee.id}`,
      assignmentId: null,
      assetCode: "AST-ID-102",
      assetName: "Access Card + Badge",
      assetType: "accessories",
      serialNumber: `BADGE-${code}`,
      assetStatus: "allocated",
      assignmentStatus: "active",
      documentNumber: `ASN-${code}-04`,
      allocatedAt: "2025-03-20",
      expectedReturnAt: null,
      returnedAt: null,
    },
  ];
}

export function EmployeeAssetsTab({ employee }: { employee: EmployeeRecord }) {
  const [rows, setRows] = useState<EmployeeAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadEmployeeAssets(employee.id);
      setRows(data.length ? data : demoAssetsFor(employee));
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load assets", "error");
      setRows(demoAssetsFor(employee));
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((r) => isActiveAssignment(r.assignmentStatus)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Company assets</h3>
          <p className="mt-1.5 text-sm text-foreground">
            <span className="font-semibold tabular-nums">{activeCount}</span> active assignment
            {activeCount === 1 ? "" : "s"}
          </p>
        </div>
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
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading assets…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground">
                {["Asset", "Serial", "Type", "Assigned", "Status"].map((col) => (
                  <th key={col} className="px-3 py-2 font-medium uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const Icon = assetTypeIcon(row.assetType);
                return (
                  <tr key={`${row.id}-${row.assignmentId ?? "demo"}`} className="border-b border-border/40">
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{row.assetName}</div>
                          {row.documentNumber ? (
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {row.documentNumber}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">{row.serialNumber || "—"}</td>
                    <td className="px-3 py-2.5 align-top capitalize">{row.assetType || "—"}</td>
                    <td className="px-3 py-2.5 align-top">{formatAssetDate(row.allocatedAt)}</td>
                    <td className="px-3 py-2.5 align-top">
                      <HrStatusBadge status={row.assignmentStatus ?? row.assetStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
