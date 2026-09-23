"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Loader2, MoreVertical, RefreshCw } from "lucide-react";

import {
  branchLookupFromOptions,
  mapTransfersToDashboardRows,
  resolveBranchLabel,
  type DashboardTransferRow,
} from "@/components/assets/dashboard.mapper";
import {
  ASSETS_SURFACE_CARD,
  StatusBadge,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { listBranchOptions } from "@/lib/org-options";
import { cn } from "@/lib/utils";
import { ApiClientError, resourceService } from "@/services/api-client";
import { assetOperationsService } from "@/services/assets-service";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type RowAction = "view" | "submit" | "cancel" | "approve" | "reject" | "reopen" | "resubmit";

type MenuPlacement = {
  top: number;
  left: number;
  openUp: boolean;
};

const MENU_MIN_WIDTH = 160;
const MENU_VIEWPORT_PAD = 8;
const MENU_GAP = 4;

function fromToLabel(location: string, branchId: string | null, branchLookup: Record<string, string>) {
  const branch = resolveBranchLabel(branchId, branchLookup);
  if (location && location !== "—" && branch !== "—") return `${location} · ${branch}`;
  if (location && location !== "—") return location;
  return branch;
}

function TransferRowMenu({
  row,
  currentUserId,
  disabled,
  onAction,
}: {
  row: DashboardTransferRow;
  currentUserId: string | null;
  disabled?: boolean;
  onAction: (action: RowAction, row: DashboardTransferRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = row.status.toLowerCase();

  const items: Array<{ id: RowAction; label: string }> = [{ id: "view", label: "View details" }];
  if (status === "draft") {
    items.push({ id: "submit", label: "Submit" }, { id: "cancel", label: "Cancel" });
  } else if (status === "submitted") {
    const canApprove =
      !currentUserId || !row.createdBy || currentUserId !== row.createdBy;
    if (canApprove) {
      items.push({ id: "approve", label: "Approve" }, { id: "reject", label: "Reject" });
    }
  } else if (status === "cancelled" && row.workflowStatus === "rejected") {
    items.push({ id: "reopen", label: "Reopen" }, { id: "resubmit", label: "Resubmit" });
  }

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuHeight = menuEl?.offsetHeight ?? items.length * 36 + 8;
    const menuWidth = Math.max(menuEl?.offsetWidth ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_PAD;
    const spaceAbove = rect.top - MENU_VIEWPORT_PAD;
    const openUp = spaceBelow < menuHeight + MENU_GAP && spaceAbove > spaceBelow;
    let top = openUp ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
    top = Math.min(
      Math.max(MENU_VIEWPORT_PAD, top),
      Math.max(MENU_VIEWPORT_PAD, window.innerHeight - menuHeight - MENU_VIEWPORT_PAD),
    );
    let left = rect.right - menuWidth;
    left = Math.min(
      Math.max(MENU_VIEWPORT_PAD, left),
      Math.max(MENU_VIEWPORT_PAD, window.innerWidth - menuWidth - MENU_VIEWPORT_PAD),
    );
    setPlacement({ top, left, openUp });
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const frame = requestAnimationFrame(() => updatePlacement());
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            data-testid={`transfer-row-menu-${row.documentNumber}`}
            data-placement={placement?.openUp ? "top" : "bottom"}
            className="z-[100] min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
            style={{
              position: "fixed",
              top: placement?.top ?? -9999,
              left: placement?.left ?? -9999,
              visibility: placement ? "visible" : "hidden",
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onAction(item.id, row);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative inline-flex">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 cursor-pointer transition-colors duration-200"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Actions for ${row.documentNumber}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="size-4" aria-hidden />
      </Button>
      {menu}
    </div>
  );
}

/**
 * Simple transfer-document register — same data shape as Dashboard Transfer List.
 * Not the User Transfer wizard (`/assets/asset-transfers/new`).
 */
export function AssetTransferRegister() {
  const searchParams = useSearchParams();
  const focusDocument = (searchParams.get("document") || "").trim();

  const [rows, setRows] = useState<DashboardTransferRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState(focusDocument);
  const [branchLookup, setBranchLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentUserId = useMemo(() => getAccessTokenUserId(), []);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const [transfers, assets] = await Promise.all([
        assetOperationsService.listTransfers({
          page,
          page_size: pageSize,
          status: statusFilter === "all" ? undefined : statusFilter,
          q: search.trim() || undefined,
        }),
        assetOperationsService.listAssets({ page: 1, page_size: 200 }),
      ]);
      const mapped = mapTransfersToDashboardRows(transfers, assets);
      setRows(mapped);
      setTotal(transfers.total ?? mapped.length);
      if (focusDocument) {
        const match = mapped.find((row) => row.documentNumber === focusDocument);
        if (match) setSelectedId(match.id);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load transfers");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [focusDocument, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    void listBranchOptions()
      .then((options) =>
        setBranchLookup(
          branchLookupFromOptions(options.map((o) => ({ id: o.id, label: o.label }))),
        ),
      )
      .catch(() => setBranchLookup({}));
  }, []);

  async function runAction(action: RowAction, row: DashboardTransferRow) {
    if (action === "view") {
      setSelectedId(row.id);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const body =
        action === "approve" || action === "reject"
          ? { comments: undefined }
          : undefined;
      await resourceService.action("/assets/asset-transfers", row.id, action, body);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="asset-transfer-register">
      <PageHeader title="Transfers" description="View asset transfer records." />

      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Card className={cn(ASSETS_SURFACE_CARD, "overflow-hidden border-l-[3px] border-l-[#0369A1]/70")}>
        <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/50 bg-muted/15 pb-3 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">Transfer list</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {total} transfer document{total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="transfer-register-search" className="text-xs">
                Search
              </Label>
              <Input
                id="transfer-register-search"
                aria-label="Search transfers"
                placeholder="Document, asset…"
                className="h-8 w-[200px]"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transfer-register-status" className="text-xs">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setPage(1);
                  setStatusFilter(value);
                }}
              >
                <SelectTrigger
                  id="transfer-register-status"
                  aria-label="Filter transfers by status"
                  className="h-8 w-[140px]"
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[880px] text-left text-sm"
              data-testid="transfer-register-table"
            >
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className={tableSerialHeaderClassName()} scope="col">
                    {TABLE_SERIAL_HEADER_LABEL}
                  </th>
                  <th className="px-3 py-2 font-semibold">Document</th>
                  <th className="px-3 py-2 font-semibold">Asset</th>
                  <th className="px-3 py-2 font-semibold">From</th>
                  <th className="px-3 py-2 font-semibold">To</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Effective</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                      <span className="sr-only">Loading transfers…</span>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const focused = selectedId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-muted/30",
                          focused && "bg-muted/40",
                        )}
                        data-testid={`transfer-row-${row.documentNumber}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className={tableSerialCellClassName()}>
                          {tableRowSerial(page, pageSize, index)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">
                          {row.documentNumber}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-[13px] font-medium text-foreground">
                            {row.assetName}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {row.assetCode}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[13px] text-muted-foreground">
                          {fromToLabel(row.fromLocation, row.fromBranchId, branchLookup)}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-muted-foreground">
                          {fromToLabel(row.toLocation, row.toBranchId, branchLookup)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge kind="lifecycle" status={row.status} />
                        </td>
                        <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-muted-foreground">
                          {row.effectiveDate ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <TransferRowMenu
                            row={row}
                            currentUserId={currentUserId}
                            disabled={actionLoading}
                            onAction={runAction}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {page}
              {total > 0 ? ` · ${total} total` : null}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 cursor-pointer transition-colors duration-200"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 cursor-pointer transition-colors duration-200"
                disabled={page * pageSize >= total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <Card className={cn(ASSETS_SURFACE_CARD)} data-testid="transfer-register-detail">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold tracking-tight">
              {selected.documentNumber}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {selected.assetCode} — {selected.assetName}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 pb-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                From
              </p>
              <p>{fromToLabel(selected.fromLocation, selected.fromBranchId, branchLookup)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                To
              </p>
              <p>{fromToLabel(selected.toLocation, selected.toBranchId, branchLookup)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <StatusBadge kind="lifecycle" status={selected.status} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Effective
              </p>
              <p className="font-mono text-xs">{selected.effectiveDate ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </p>
              <p className="text-muted-foreground">{selected.reason ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
