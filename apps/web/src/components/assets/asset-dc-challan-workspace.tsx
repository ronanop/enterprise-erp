"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Truck,
} from "lucide-react";

import { InventoryFilterPopover } from "@/components/assets/inventory/inventory-filter-popover";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  StatCard,
  StatusBadge,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { DC_CHALLAN_STATUS_LABELS, type DcChallanStatusValue } from "@/components/assets/shared/asset-status";
import { isAuthenticated } from "@/lib/auth";
import { isManualEntryDcChallan } from "@/components/assets/navigation/dc-challan-navigation";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import {
  dcChallanService,
  type DcChallanBulkSendResult,
  type DcChallanRow,
  type DcChallanSummary,
  type DcChallanUploadLimits,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";
import { DcChallanCreateDialog } from "@/components/assets/dc-challan/dc-challan-create-dialog";
import { DcChallanDocumentBlock } from "@/components/assets/dc-challan/dc-challan-document-block";
import {
  DcChallanDocumentPreviewModal,
  type DcChallanDocumentPreviewState,
} from "@/components/assets/dc-challan/dc-challan-document-preview-modal";
import {
  printBlobUrl,
  resolveScmIssuedDocument,
  resolveSignedDocument,
} from "@/components/assets/dc-challan/dc-challan-document";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "SENT_TO_SCM", label: "Sent to SCM" },
  { value: "DOCUMENT_RECEIVED", label: "Document received" },
  { value: "SIGNED", label: "Signed" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

function emptySummary(): DcChallanSummary {
  return {
    pending: 0,
    sent_to_scm: 0,
    document_received: 0,
    signed: 0,
    received: 0,
    cancelled: 0,
  };
}

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function AssetDcChallanWorkspace() {
  const searchParams = useSearchParams();
  const { can } = useUserPermissions();
  const canReceive = can("asset.dc_challan:receive");
  const queryAssetId = searchParams.get("assetId") ?? "";
  const queryAssignmentId = searchParams.get("assignmentId") ?? "";
  const queryChallanId = searchParams.get("challanId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DcChallanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [summary, setSummary] = useState<DcChallanSummary>(emptySummary());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<DcChallanBulkSendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawerRow, setDrawerRow] = useState<DcChallanRow | null>(null);
  const [createOpen, setCreateOpen] = useState(Boolean(queryAssetId) && !queryChallanId);
  const [createAssetId, setCreateAssetId] = useState(queryAssetId);
  const [createAssignmentId, setCreateAssignmentId] = useState(queryAssignmentId);
  const [lockCreatePrefill, setLockCreatePrefill] = useState(Boolean(queryAssetId) && !queryChallanId);
  const [preview, setPreview] = useState<DcChallanDocumentPreviewState | null>(null);
  const [uploadLimits, setUploadLimits] = useState<DcChallanUploadLimits | null>(null);

  const activeChipCount = useMemo(() => {
    let n = 0;
    if (statusFilter) n += 1;
    if (unlinkedOnly) n += 1;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    if (search.trim()) n += 1;
    if (queryAssetId) n += 1;
    return n;
  }, [statusFilter, unlinkedOnly, dateFrom, dateTo, search, queryAssetId]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const [list, counts] = await Promise.all([
        dcChallanService.search({
          page,
          page_size: pageSize,
          status: statusFilter || undefined,
          q: search.trim() || undefined,
          unlinked: unlinkedOnly || undefined,
          created_from: dateFrom || undefined,
          created_to: dateTo || undefined,
          asset_id: queryAssetId || undefined,
          assignment_id: queryAssignmentId || undefined,
        }),
        dcChallanService.summary(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(counts);
      setUploadLimits(counts.upload_limits ?? list.upload_limits ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load DC challans");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, unlinkedOnly, dateFrom, dateTo, queryAssetId, queryAssignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!queryChallanId || !isAuthenticated()) return;
    let cancelled = false;
    void dcChallanService
      .get(queryChallanId)
      .then((row) => {
        if (!cancelled) setDrawerRow(row);
      })
      .catch(() => {
        if (!cancelled) setError("DC challan not found");
      });
    return () => {
      cancelled = true;
    };
  }, [queryChallanId]);

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.filter((row) => row.status === "PENDING").map((row) => row.id)));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulkSend = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setBulkResult(null);
    try {
      const result = await dcChallanService.bulkSendToScm([...selected]);
      setBulkResult(result);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Bulk send failed");
    } finally {
      setBusy(false);
    }
  };

  const runDrawerAction = async (action: () => Promise<DcChallanRow>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setDrawerRow(row);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = (kind: "scm-issued" | "signed", document: NonNullable<DcChallanRow["scm_issued_document"]>) => {
    if (!drawerRow) return;
    setPreview({ row: drawerRow, kind, document });
  };

  const downloadDocument = async (kind: "scm-issued" | "signed") => {
    if (!drawerRow) return;
    try {
      const result = await dcChallanService.getDocumentBlob(drawerRow.id, kind, "attachment");
      if (result.kind === "legacy") {
        window.open(result.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const href = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Download failed");
    }
  };

  const printDocument = async (kind: "scm-issued" | "signed") => {
    if (!drawerRow) return;
    try {
      const result = await dcChallanService.getDocumentBlob(drawerRow.id, kind, "inline");
      if (result.kind === "legacy") {
        window.open(result.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const href = URL.createObjectURL(result.blob);
      await printBlobUrl(href);
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Print failed");
    }
  };

  const isManualEmployee = Boolean(drawerRow && isManualEntryDcChallan(drawerRow));
  const phoneWarning =
    drawerRow && !isManualEmployee && !String(drawerRow.employee_phone ?? "").trim();
  const emailWarning =
    drawerRow && isManualEmployee && !String(drawerRow.employee_email ?? "").trim();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyStatusKpiFilter = (status: string) => {
    setStatusFilter((prev) => (prev === status ? "" : status));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="DC Challan"
        description="Track delivery challans independently of assignment delivery references."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                const fromDeepLink = Boolean(queryAssetId);
                setCreateAssetId(queryAssetId);
                setCreateAssignmentId(queryAssignmentId);
                setLockCreatePrefill(fromDeepLink);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create DC Challan
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" data-testid="dc-challan-kpi-strip">
        <StatCard
          title="Pending"
          value={summary.pending}
          icon={FileText}
          loading={loading}
          selected={statusFilter === "PENDING"}
          aria-label="Filter by Pending"
          onClick={() => applyStatusKpiFilter("PENDING")}
        />
        <StatCard
          title="Sent to SCM"
          value={summary.sent_to_scm}
          icon={Send}
          loading={loading}
          selected={statusFilter === "SENT_TO_SCM"}
          aria-label="Filter by Sent to SCM"
          onClick={() => applyStatusKpiFilter("SENT_TO_SCM")}
        />
        <StatCard
          title="Document received"
          value={summary.document_received}
          icon={Truck}
          loading={loading}
          selected={statusFilter === "DOCUMENT_RECEIVED"}
          aria-label="Filter by Document received"
          onClick={() => applyStatusKpiFilter("DOCUMENT_RECEIVED")}
        />
        <StatCard
          title="Signed"
          value={summary.signed}
          loading={loading}
          selected={statusFilter === "SIGNED"}
          aria-label="Filter by Signed"
          onClick={() => applyStatusKpiFilter("SIGNED")}
        />
        <StatCard
          title="Received"
          value={summary.received}
          icon={CheckCircle2}
          loading={loading}
          selected={statusFilter === "RECEIVED"}
          aria-label="Filter by Received"
          onClick={() => applyStatusKpiFilter("RECEIVED")}
        />
        <StatCard
          title="Cancelled"
          value={summary.cancelled}
          loading={loading}
          selected={statusFilter === "CANCELLED"}
          aria-label="Filter by Cancelled"
          onClick={() => applyStatusKpiFilter("CANCELLED")}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            aria-label="Search DC challans"
            placeholder="DC number, tag, employee…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
                setPage(1);
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => {
              setSearch(searchInput);
              setPage(1);
            }}
          >
            Search
          </Button>
        </div>
        <InventoryFilterPopover activeCount={activeChipCount}>
          {({ close }) => (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(v) => {
                    setStatusFilter(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((opt) => (
                      <SelectItem key={opt.value || "all"} value={opt.value || "all"} className="cursor-pointer">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={unlinkedOnly}
                  onChange={(e) => {
                    setUnlinkedOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                Unlinked only
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dc-from">From</Label>
                  <Input
                    id="dc-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dc-to">To</Label>
                  <Input
                    id="dc-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={close}>
                Done
              </Button>
            </div>
          )}
        </InventoryFilterPopover>
        <Button
          type="button"
          className="cursor-pointer transition-colors duration-200"
          disabled={selected.size === 0 || busy}
          onClick={() => void runBulkSend()}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Send to SCM ({selected.size})
        </Button>
      </div>

      {activeChipCount > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="dc-challan-filter-chips">
          {search.trim() ? (
            <FilterChip label={`Search: ${search.trim()}`} onDismiss={() => setSearch("")} />
          ) : null}
          {statusFilter ? (
            <FilterChip
              label={`Status: ${DC_CHALLAN_STATUS_LABELS[statusFilter as DcChallanStatusValue] ?? statusFilter}`}
              onDismiss={() => setStatusFilter("")}
            />
          ) : null}
          {unlinkedOnly ? <FilterChip label="Unlinked" onDismiss={() => setUnlinkedOnly(false)} /> : null}
          {queryAssetId ? <FilterChip label="Filtered by asset" onDismiss={() => undefined} /> : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {bulkResult ? (
        <Card className="border-border/80" data-testid="dc-challan-bulk-result">
          <CardContent className="space-y-2 pt-4 text-sm">
            <p>
              Sent {bulkResult.sent_count}, skipped {bulkResult.skipped_count}.
            </p>
            {bulkResult.results
              .filter((item) => !item.ok)
              .map((item) => (
                <p key={item.id} className="text-amber-800">
                  {item.id}: {item.reason}
                </p>
              ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    aria-label="Select pending rows"
                    onChange={(e) => toggleAll(e.target.checked)}
                    checked={items.some((r) => r.status === "PENDING") && items.filter((r) => r.status === "PENDING").every((r) => selected.has(r.id))}
                  />
                </th>
                <th className="px-3 py-2">DC number</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Linked</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6">
                    <EmptyState variant="no-results" title="No DC challans" description="Create a challan from an employee assignment or a Ready to Move asset." />
                  </td>
                </tr>
              ) : (
                items.map((row, index) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                    onClick={() => setDrawerRow(row)}
                  >
                    <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        disabled={row.status !== "PENDING"}
                        checked={selected.has(row.id)}
                        onChange={(e) => toggleOne(row.id, e.target.checked)}
                        aria-label={`Select ${row.dc_number}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.dc_number}</td>
                    <td className="px-3 py-2">
                      <StatusBadge kind="dcChallan" status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.asset_name ?? "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.asset_tag}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.employee_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.employee_code}</div>
                    </td>
                    <td className="px-3 py-2">{row.assignment_id ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatWhen(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {total} row{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <DcChallanCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialAssetId={createAssetId}
        initialAssignmentId={createAssignmentId}
        lockPrefill={lockCreatePrefill}
        busy={busy}
        onCreated={(row) => {
          setDrawerRow(row);
          void load();
        }}
      />

      {drawerRow ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="presentation" onClick={() => setDrawerRow(null)}>
          <aside
            className="h-full w-full max-w-lg overflow-y-auto border-l border-border/80 bg-background p-5 shadow-xl"
            role="dialog"
            aria-label="DC challan detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{drawerRow.dc_number}</p>
                <h2 className="text-base font-medium">{drawerRow.asset_name ?? "DC Challan"}</h2>
              </div>
              <StatusBadge kind="dcChallan" status={drawerRow.status} />
            </div>

            {phoneWarning ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Employee phone is blank. Sending to SCM is still allowed.
              </p>
            ) : null}
            {emailWarning ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Employee email is blank. Sending to SCM is still allowed.
              </p>
            ) : null}

            <section className="mt-5 space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Asset</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Tag</dt>
                  <dd className="font-mono text-xs">{drawerRow.asset_tag ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Serial</dt>
                  <dd>{drawerRow.serial_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Make / model</dt>
                  <dd>
                    {[drawerRow.make, drawerRow.model].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="mt-5 space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd>{drawerRow.employee_name ?? "—"}</dd>
                </div>
                {isManualEmployee ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Deployed to</dt>
                    <dd data-testid="dc-challan-deployed-to">{drawerRow.deployed_to}</dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-xs text-muted-foreground">Code</dt>
                    <dd>{drawerRow.employee_code ?? "—"}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd>{drawerRow.employee_email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{drawerRow.employee_phone || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="mt-5 space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Timeline</h3>
              <ul className="space-y-1 text-sm">
                <li>Sent: {formatWhen(drawerRow.sent_to_scm_at)}</li>
                <li>Document: {formatWhen(drawerRow.scm_document_uploaded_at)}</li>
                <li>Signed: {formatWhen(drawerRow.signed_at)}</li>
                <li>Received: {formatWhen(drawerRow.received_at)}</li>
              </ul>
              {drawerRow.remarks ? (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{drawerRow.remarks}</p>
              ) : null}
            </section>

            <section className="mt-5 space-y-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Documents</h3>
              <DcChallanDocumentBlock
                title="SCM Challan Document"
                row={drawerRow}
                kind="scm-issued"
                document={resolveScmIssuedDocument(drawerRow)}
                emptyHint="No SCM document yet."
                showUploader={drawerRow.status === "SENT_TO_SCM" && !resolveScmIssuedDocument(drawerRow)}
                canUpload={drawerRow.status === "SENT_TO_SCM"}
                uploadLabel="Upload SCM document manually"
                helperText="Use this until the SCM module is connected. Once connected, documents arrive automatically."
                uploading={busy}
                uploadLimits={uploadLimits}
                canReplace={
                  canReceive &&
                  drawerRow.status !== "CANCELLED" &&
                  Boolean(resolveScmIssuedDocument(drawerRow))
                }
                onUpload={(file) =>
                  void runDrawerAction(() => dcChallanService.uploadScmIssued(drawerRow.id, file))
                }
                onView={() => {
                  const doc = resolveScmIssuedDocument(drawerRow);
                  if (doc) openPreview("scm-issued", doc);
                }}
                onDownload={() => void downloadDocument("scm-issued")}
                onPrint={() => void printDocument("scm-issued")}
              />
              <DcChallanDocumentBlock
                title="Signed Document"
                row={drawerRow}
                kind="signed"
                document={resolveSignedDocument(drawerRow)}
                emptyHint="No signed copy yet."
                showUploader={drawerRow.status === "DOCUMENT_RECEIVED" && !resolveSignedDocument(drawerRow)}
                canUpload={drawerRow.status === "DOCUMENT_RECEIVED"}
                uploadLabel="Upload signed copy"
                helperText="Uploading the signed copy marks this challan as signed."
                uploading={busy}
                uploadLimits={uploadLimits}
                canReplace={
                  canReceive &&
                  drawerRow.status !== "CANCELLED" &&
                  Boolean(resolveSignedDocument(drawerRow))
                }
                onUpload={(file) =>
                  void runDrawerAction(() => dcChallanService.uploadSigned(drawerRow.id, file))
                }
                onView={() => {
                  const doc = resolveSignedDocument(drawerRow);
                  if (doc) openPreview("signed", doc);
                }}
                onDownload={() => void downloadDocument("signed")}
                onPrint={() => void printDocument("signed")}
              />
            </section>

            <div className="mt-6 flex flex-wrap gap-2">
              {drawerRow.status === "PENDING" ? (
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => void runDrawerAction(() => dcChallanService.sendToScm(drawerRow.id))}
                >
                  Send to SCM
                </Button>
              ) : null}
              {drawerRow.status === "SIGNED" ? (
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => void runDrawerAction(() => dcChallanService.markReceived(drawerRow.id))}
                >
                  Mark received
                </Button>
              ) : null}
              {drawerRow.status !== "RECEIVED" && drawerRow.status !== "CANCELLED" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => void runDrawerAction(() => dcChallanService.cancel(drawerRow.id))}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => setDrawerRow(null)}>
                Close
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
      <DcChallanDocumentPreviewModal open={preview} onOpenChange={setPreview} />
    </div>
  );
}

function FilterChip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs">
      {label}
      <button
        type="button"
        className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
        aria-label={`Remove ${label}`}
        onClick={onDismiss}
      >
        ×
      </button>
    </span>
  );
}
