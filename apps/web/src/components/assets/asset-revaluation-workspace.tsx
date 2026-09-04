"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  SquarePen,
} from "lucide-react";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";


import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  branch_id: string;
  status: string;
  current_book_value?: string | number | null;
};

type RevaluationRow = {
  id: string;
  document_number: string;
  asset_id: string;
  revaluation_date?: string | null;
  old_book_value?: string | number | null;
  new_book_value?: string | number | null;
  reason?: string | null;
  finance_journal_id?: string | null;
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

const STATUS_OPTIONS = ["", "draft", "submitted", "approved", "posted", "cancelled"] as const;

function parseListItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as ListPayload<T>).items;
    return Array.isArray(items) ? items : [];
  }
  return [];
}

function shortId(value?: string | null): string {
  return value ? value.slice(0, 8) : "None";
}

export function AssetRevaluationWorkspace() {
  const apiPath = "/assets/asset-revaluations";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<RevaluationRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<RevaluationRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowComments, setWorkflowComments] = useState("");
  const [postAccounts, setPostAccounts] = useState({
    debit_account_id: "",
    credit_account_id: "",
    fiscal_year_id: "",
  });
  const [draft, setDraft] = useState({
    asset_id: "",
    branch_id: "",
    revaluation_date: "",
    new_book_value: "",
    reason: "",
  });
  const [edit, setEdit] = useState({
    revaluation_date: "",
    new_book_value: "",
    reason: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const currentUserId = useMemo(() => getAccessTokenUserId(), []);

  const canWorkflowAct = useMemo(() => {
    if (!selected || selected.status !== "submitted") return false;
    if (selected.workflow_status && selected.workflow_status !== "in_progress") {
      return false;
    }
    return true;
  }, [selected]);

  const canApproveOrReject = useMemo(() => {
    if (!canWorkflowAct) return false;
    if (!currentUserId || !selected?.created_by) return true;
    return currentUserId !== selected.created_by;
  }, [canWorkflowAct, currentUserId, selected]);

  const isCreatorBlockedBySod = useMemo(() => {
    if (!canWorkflowAct || !currentUserId || !selected?.created_by) return false;
    return currentUserId === selected.created_by;
  }, [canWorkflowAct, currentUserId, selected]);

  const canSubmit = useMemo(() => {
    if (!selected || selected.status !== "draft") return false;
    return Boolean(selected.revaluation_date);
  }, [selected]);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const active = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=active`,
      );
      const maintenance = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=100&status=in_maintenance`,
      );
      const merged = [
        ...parseListItems<AssetRow>(active.data),
        ...parseListItems<AssetRow>(maintenance.data),
      ];
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
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<RevaluationRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<RevaluationRow> | RevaluationRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load revaluations");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      revaluation_date: selected.revaluation_date ?? "",
      new_book_value:
        selected.new_book_value != null ? String(selected.new_book_value) : "",
      reason: selected.reason ?? "",
    });
  }, [selected]);

  function onDraftAssetChange(assetId: string) {
    const asset = assetMap.get(assetId);
    setDraft((s) => ({
      ...s,
      asset_id: assetId,
      branch_id: asset?.branch_id ?? "",
    }));
  }

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<RevaluationRow>(apiPath, id);
      setSelected(res.data as RevaluationRow);
    } catch {
      setSelected(null);
    }
  }

  async function createDraft() {
    if (!draft.asset_id || !draft.branch_id) {
      setError("Select an asset.");
      return;
    }
    if (!draft.new_book_value.trim()) {
      setError("new_book_value is required.");
      return;
    }
    if (!draft.reason.trim()) {
      setError("reason is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id,
        revaluation_date: draft.revaluation_date || undefined,
        new_book_value: Number(draft.new_book_value),
        reason: draft.reason.trim(),
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        revaluation_date: "",
        new_book_value: "",
        reason: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!selected || selected.status !== "draft") return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.update(apiPath, selected.id, {
        revaluation_date: edit.revaluation_date || null,
        new_book_value: edit.new_book_value ? Number(edit.new_book_value) : undefined,
        reason: edit.reason.trim() || undefined,
        version: selected.version,
      });
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(action: string, body?: Record<string, unknown>) {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.action(apiPath, selected.id, action, body);
      await load();
      await refreshSelected(selected.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function postToFinance() {
    if (!postAccounts.debit_account_id.trim() || !postAccounts.credit_account_id.trim()) {
      setError("Debit and credit account UUIDs are required.");
      return;
    }
    await runAction("post", {
      debit_account_id: postAccounts.debit_account_id.trim(),
      credit_account_id: postAccounts.credit_account_id.trim(),
      fiscal_year_id: postAccounts.fiscal_year_id.trim() || undefined,
    });
  }

  const statusBadge = (row: RevaluationRow) => (
    <Badge variant="secondary" className="font-mono text-xs">
      {row.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset revaluation"
        description="Governed book-value adjustments with approval workflow and Finance posting."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Revaluations</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search revaluations"
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
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {page} · {total} total
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      New BV
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                        No revaluations found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const asset = assetMap.get(row.asset_id);
                      const isSelected = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t transition-colors duration-200 hover:bg-muted/40 ${
                            isSelected ? "bg-muted/50" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, pageSize, index)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved"}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.new_book_value ?? "—"}
                          </td>
                          <td className="px-3 py-2">{statusBadge(row)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="rev-asset">Asset</Label>
                <Select
                  value={draft.asset_id || undefined}
                  onValueChange={onDraftAssetChange}
                >
                  <SelectTrigger id="rev-asset" className="cursor-pointer">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                        {asset.asset_code} — {asset.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-date">Revaluation date</Label>
                <Input
                  id="rev-date"
                  type="date"
                  value={draft.revaluation_date}
                  onChange={(e) => setDraft((s) => ({ ...s, revaluation_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-new-bv">New book value</Label>
                <Input
                  id="rev-new-bv"
                  type="number"
                  value={draft.new_book_value}
                  onChange={(e) => setDraft((s) => ({ ...s, new_book_value: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-reason">Reason</Label>
                <Input
                  id="rev-reason"
                  value={draft.reason}
                  onChange={(e) => setDraft((s) => ({ ...s, reason: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void createDraft()}
              >
                <SquarePen className="mr-2 h-4 w-4" />
                Create draft
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a revaluation to manage.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="font-mono text-xs">{selected.document_number}</div>
                    <div>{statusBadge(selected)}</div>
                    <div className="text-muted-foreground">
                      Old {selected.old_book_value ?? "—"} → New {selected.new_book_value ?? "—"}
                    </div>
                    <div className="text-muted-foreground">{selected.reason ?? "—"}</div>
                    <div className="text-muted-foreground">
                      Journal {shortId(selected.finance_journal_id)} · WF{" "}
                      {selected.workflow_status ?? "none"}
                    </div>
                  </div>

                  {selected.status === "draft" ? (
                    <div className="space-y-3 border-t pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="rev-edit-date">Revaluation date</Label>
                        <Input
                          id="rev-edit-date"
                          type="date"
                          value={edit.revaluation_date}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, revaluation_date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rev-edit-bv">New book value</Label>
                        <Input
                          id="rev-edit-bv"
                          type="number"
                          value={edit.new_book_value}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, new_book_value: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rev-edit-reason">Reason</Label>
                        <Input
                          id="rev-edit-reason"
                          value={edit.reason}
                          onChange={(e) => setEdit((s) => ({ ...s, reason: e.target.value }))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void saveDraft()}
                      >
                        Save draft
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Draft can be saved without a date. Set and save a revaluation date before
                        Submit.
                      </p>
                    </div>
                  ) : null}

                  {selected.status === "draft" && !selected.revaluation_date ? (
                    <p className="text-xs text-muted-foreground">
                      Submit requires a revaluation date. Save the date on this draft first.
                    </p>
                  ) : null}

                  {isCreatorBlockedBySod ? (
                    <p className="text-xs text-muted-foreground">
                      You created this revaluation and cannot approve or reject it (segregation of
                      duties). Another authorized user must act.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canSubmit}
                      onClick={() => void runAction("submit")}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() =>
                        void runAction("approve", {
                          comments: workflowComments || undefined,
                        })
                      }
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || !canApproveOrReject}
                      onClick={() =>
                        void runAction("reject", {
                          comments: workflowComments || undefined,
                        })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "draft"}
                      onClick={() => void runAction("cancel")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(
                          selected.status === "cancelled" &&
                          selected.workflow_status === "rejected"
                        )
                      }
                      onClick={() => void runAction("reopen")}
                    >
                      Reopen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={
                        actionLoading ||
                        !(
                          selected.status === "cancelled" &&
                          selected.workflow_status === "rejected"
                        )
                      }
                      onClick={() => void runAction("resubmit")}
                    >
                      Resubmit
                    </Button>
                  </div>

                  {(selected.status === "submitted" ||
                    selected.status === "cancelled") && (
                    <div className="space-y-2">
                      <Label htmlFor="rev-comments">Workflow comments</Label>
                      <Input
                        id="rev-comments"
                        value={workflowComments}
                        onChange={(e) => setWorkflowComments(e.target.value)}
                      />
                    </div>
                  )}

                  {selected.status === "approved" ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Post orientation: supply debit/credit GL accounts for the revaluation
                        delta (|new − old|). Increase vs decrease mapping is operator-driven.
                        Book value updates only after successful Finance post.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="rev-debit">Debit account UUID</Label>
                        <Input
                          id="rev-debit"
                          value={postAccounts.debit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, debit_account_id: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rev-credit">Credit account UUID</Label>
                        <Input
                          id="rev-credit"
                          value={postAccounts.credit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, credit_account_id: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void postToFinance()}
                      >
                        <Banknote className="mr-2 h-4 w-4" />
                        Post to Finance
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
