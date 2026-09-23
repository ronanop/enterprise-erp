"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";

type DisposalRow = {
  id: string;
  document_number: string;
  asset_id: string;
  disposal_type: string;
  disposal_date?: string | null;
  remarks?: string | null;
  management_approved?: boolean | null;
  status: string;
  version: number;
  branch_id: string;
  created_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  asset_code?: string | null;
  asset_name?: string | null;
  make?: string | null;
  model?: string | null;
  configuration?: string | null;
  serial_number?: string | null;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function parseListTotal(data: unknown): number {
  if (data && typeof data === "object" && "total" in data) {
    const total = Number((data as ListPayload<unknown>).total);
    return Number.isFinite(total) ? total : 0;
  }
  if (Array.isArray(data)) return data.length;
  return 0;
}

function displayValue(value?: string | null): string {
  const text = value?.trim();
  return text ? text : "—";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = value.slice(0, 10);
  return d || "—";
}

function approvalLabel(value?: boolean | null): string {
  if (value === true) return "Yes / Approved";
  if (value === false) return "No / Not Approved";
  return "—";
}

export function AssetDisposalWorkspace() {
  const apiPath = "/assets/asset-disposals";

  const [rows, setRows] = useState<DisposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisposalRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await resourceService.list<ListPayload<DisposalRow>>(apiPath, {
        page,
        page_size: pageSize,
        q: search.trim() || undefined,
        status: "posted",
      });
      setRows(parseListItems<DisposalRow>(res.data));
      setTotal(parseListTotal(res.data));
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof ApiClientError ? err.message : "Failed to load disposed assets");
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetails(row: DisposalRow) {
    setDetail(row);
    setDetailLoading(true);
    try {
      const res = await resourceService.get<DisposalRow>(apiPath, row.id);
      if (res.data) {
        setDetail({ ...row, ...(res.data as DisposalRow) });
      }
    } catch {
      // Keep list row data if get fails.
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disposed assets"
        description="Assets marked as disposed. Use View Details for reason, approval, and disposal date."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <RefreshCw className="mr-1.5 size-4" />}
            Refresh
          </Button>
        }
      />

      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <label htmlFor="disposed-search" className="text-sm font-medium">
            Search
          </label>
          <Input
            id="disposed-search"
            data-testid="disposed-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Asset code, document, make…"
            className="transition-colors duration-200"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/80">
        <table className="min-w-full text-sm" data-testid="disposed-assets-table">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={tableSerialHeaderClassName()} scope="col">
                {TABLE_SERIAL_HEADER_LABEL}
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Asset Code
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Configuration
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Make
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Model
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Disposal Date
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  No disposed assets found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-t border-border/60 transition-colors duration-150 hover:bg-muted/30"
                  data-testid={`disposed-row-${row.id}`}
                >
                  <td className={tableSerialCellClassName()}>
                    {tableRowSerial(page, pageSize, index)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {displayValue(row.asset_code)}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={row.configuration ?? undefined}>
                    {displayValue(row.configuration)}
                  </td>
                  <td className="px-3 py-2">{displayValue(row.make)}</td>
                  <td className="px-3 py-2">{displayValue(row.model)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{formatDate(row.disposal_date)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="cursor-pointer text-sm font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline"
                      data-testid={`disposed-view-${row.id}`}
                      onClick={() => void openDetails(row)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disposed-detail-title"
          data-testid="disposed-detail-drawer"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="disposed-detail-title" className="text-base font-semibold">
                  Disposal details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {displayValue(detail.asset_code)}
                  {detail.asset_name ? ` · ${detail.asset_name}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setDetail(null)}
              >
                Close
              </Button>
            </div>

            {detailLoading ? (
              <div className="mt-6 flex justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <dl className="mt-4 divide-y divide-border/50 rounded-md border border-border/70">
                {[
                  { label: "Asset code", value: displayValue(detail.asset_code) },
                  { label: "Asset name", value: displayValue(detail.asset_name) },
                  { label: "Serial number", value: displayValue(detail.serial_number) },
                  { label: "Make", value: displayValue(detail.make) },
                  { label: "Model", value: displayValue(detail.model) },
                  { label: "Configuration", value: displayValue(detail.configuration) },
                  { label: "Document", value: displayValue(detail.document_number) },
                  { label: "Disposal type", value: displayValue(detail.disposal_type) },
                  { label: "Disposal date", value: formatDate(detail.disposal_date) },
                  { label: "Reason for disposal", value: displayValue(detail.remarks) },
                  {
                    label: "Management approval",
                    value: approvalLabel(detail.management_approved),
                  },
                  { label: "Recorded at", value: formatDate(detail.completed_at || detail.created_at) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="grid gap-1 px-3 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-3"
                  >
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="text-sm text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
