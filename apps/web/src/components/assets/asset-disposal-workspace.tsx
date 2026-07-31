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
};

type DisposalRow = {
  id: string;
  document_number: string;
  asset_id: string;
  disposal_type: string;
  disposal_date?: string | null;
  proceeds_amount?: string | number | null;
  book_value_at_disposal?: string | number | null;
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
const DISPOSAL_TYPES = ["sale", "scrap", "donation", "write_off"] as const;

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

export function AssetDisposalWorkspace() {
  const apiPath = "/assets/asset-disposals";
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<DisposalRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<DisposalRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
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
    disposal_type: "scrap",
    disposal_date: "",
    proceeds_amount: "",
    book_value_at_disposal: "",
  });
  const [edit, setEdit] = useState({
    disposal_type: "scrap",
    disposal_date: "",
    proceeds_amount: "",
    book_value_at_disposal: "",
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
      if (typeFilter) query.set("disposal_type", typeFilter);
      if (search.trim()) query.set("q", search.trim());
      const res = await resourceService.list<ListPayload<DisposalRow>>(
        `${apiPath}?${query.toString()}`,
      );
      const payload = res.data as ListPayload<DisposalRow> | DisposalRow[];
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
      setError(err instanceof ApiClientError ? err.message : "Failed to load disposals");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      disposal_type: selected.disposal_type,
      disposal_date: selected.disposal_date ?? "",
      proceeds_amount:
        selected.proceeds_amount != null ? String(selected.proceeds_amount) : "",
      book_value_at_disposal:
        selected.book_value_at_disposal != null
          ? String(selected.book_value_at_disposal)
          : "",
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

  function validateDraft(payload: typeof draft): string | null {
    if (!payload.asset_id) return "Select an asset.";
    if (!payload.branch_id) return "Branch is required.";
    if (!payload.disposal_type) return "Select a disposal type.";
    return null;
  }

  async function createDraft() {
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resourceService.create(apiPath, {
        asset_id: draft.asset_id,
        branch_id: draft.branch_id,
        disposal_type: draft.disposal_type,
        disposal_date: draft.disposal_date || undefined,
        proceeds_amount: draft.proceeds_amount ? Number(draft.proceeds_amount) : undefined,
        book_value_at_disposal: draft.book_value_at_disposal
          ? Number(draft.book_value_at_disposal)
          : undefined,
      });
      setDraft({
        asset_id: "",
        branch_id: "",
        disposal_type: "scrap",
        disposal_date: "",
        proceeds_amount: "",
        book_value_at_disposal: "",
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
        disposal_type: edit.disposal_type,
        disposal_date: edit.disposal_date || null,
        proceeds_amount: edit.proceeds_amount ? Number(edit.proceeds_amount) : null,
        book_value_at_disposal: edit.book_value_at_disposal
          ? Number(edit.book_value_at_disposal)
          : null,
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

  async function refreshSelected(id: string) {
    try {
      const res = await resourceService.get<DisposalRow>(apiPath, id);
      setSelected(res.data as DisposalRow);
    } catch {
      setSelected(null);
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
      if (action === "approve" || action === "reject") {
        setWorkflowComments("");
      }
      if (action === "post") {
        setPostAccounts({ debit_account_id: "", credit_account_id: "", fiscal_year_id: "" });
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function postDisposal() {
    if (!selected || selected.status !== "approved") return;
    if (!postAccounts.debit_account_id.trim() || !postAccounts.credit_account_id.trim()) {
      setError("Debit and credit account UUIDs are required to post.");
      return;
    }
    await runAction("post", {
      debit_account_id: postAccounts.debit_account_id.trim(),
      credit_account_id: postAccounts.credit_account_id.trim(),
      fiscal_year_id: postAccounts.fiscal_year_id.trim() || undefined,
    });
  }

  const statusBadge = useMemo(
    () => (row: DisposalRow) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {row.status}
        {row.workflow_status ? ` / ${row.workflow_status}` : ""}
      </Badge>
    ),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset disposal"
        description="Governed retirement and write-off with multi-step approval and Finance journal posting."
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Disposals</CardTitle>
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
                aria-label="Search disposals"
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
                value={typeFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setTypeFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All types
                  </SelectItem>
                  {DISPOSAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="cursor-pointer">
                      {type}
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
                    <th scope="col" className="px-3 py-2 font-medium">
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Asset
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                        No disposals found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
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
                          <td className="px-3 py-2 font-mono text-xs">{row.document_number}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{asset?.asset_name ?? row.asset_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {asset?.asset_code ?? "Unresolved asset"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">{row.disposal_type}</td>
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
              <CardTitle>Create disposal draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dsp-asset">Asset</Label>
                <Select value={draft.asset_id || undefined} onValueChange={onDraftAssetChange}>
                  <SelectTrigger id="dsp-asset" className="cursor-pointer">
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
                <Label htmlFor="dsp-type">Disposal type</Label>
                <Select
                  value={draft.disposal_type}
                  onValueChange={(value) => setDraft((s) => ({ ...s, disposal_type: value }))}
                >
                  <SelectTrigger id="dsp-type" className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dsp-date">Disposal date</Label>
                  <Input
                    id="dsp-date"
                    type="date"
                    value={draft.disposal_date}
                    onChange={(e) => setDraft((s) => ({ ...s, disposal_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dsp-book">Book value</Label>
                  <Input
                    id="dsp-book"
                    type="number"
                    value={draft.book_value_at_disposal}
                    onChange={(e) =>
                      setDraft((s) => ({ ...s, book_value_at_disposal: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dsp-proceeds">Proceeds (sale)</Label>
                <Input
                  id="dsp-proceeds"
                  type="number"
                  value={draft.proceeds_amount}
                  onChange={(e) => setDraft((s) => ({ ...s, proceeds_amount: e.target.value }))}
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
                <p className="text-sm text-muted-foreground">Select a disposal to manage workflow.</p>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="font-mono text-xs">{selected.document_number}</div>
                    <div>{statusBadge(selected)}</div>
                    <div className="text-muted-foreground">
                      Creator {shortId(selected.created_by)} · v{selected.version}
                    </div>
                    {selected.finance_journal_id ? (
                      <div className="text-muted-foreground">
                        Journal {shortId(selected.finance_journal_id)}
                      </div>
                    ) : null}
                  </div>

                  {!canApproveOrReject && canWorkflowAct ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Segregation of duties: the creator cannot approve or reject this disposal.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="dsp-comments">Workflow comments</Label>
                    <Input
                      id="dsp-comments"
                      value={workflowComments}
                      onChange={(e) => setWorkflowComments(e.target.value)}
                      placeholder="Optional approval / rejection comments"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading || selected.status !== "draft"}
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
                          selected.status === "draft" ||
                          (selected.status === "cancelled" &&
                            selected.workflow_status === "rejected")
                        )
                      }
                      onClick={() => void runAction("resubmit")}
                    >
                      Resubmit
                    </Button>
                  </div>

                  {selected.status === "approved" ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-sm text-muted-foreground">
                        Finance post is irreversible. Asset status changes only after a successful
                        journal post.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-debit">Debit account UUID</Label>
                        <Input
                          id="dsp-debit"
                          value={postAccounts.debit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, debit_account_id: e.target.value }))
                          }
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-credit">Credit account UUID</Label>
                        <Input
                          id="dsp-credit"
                          value={postAccounts.credit_account_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, credit_account_id: e.target.value }))
                          }
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-fy">Fiscal year UUID (optional)</Label>
                        <Input
                          id="dsp-fy"
                          value={postAccounts.fiscal_year_id}
                          onChange={(e) =>
                            setPostAccounts((s) => ({ ...s, fiscal_year_id: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void postDisposal()}
                      >
                        <Banknote className="mr-2 h-4 w-4" />
                        Post to Finance
                      </Button>
                    </div>
                  ) : null}

                  {selected.status === "draft" ? (
                    <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dsp-edit-type">Type</Label>
                        <Select
                          value={edit.disposal_type}
                          onValueChange={(value) =>
                            setEdit((s) => ({ ...s, disposal_type: value }))
                          }
                        >
                          <SelectTrigger id="dsp-edit-type" className="cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISPOSAL_TYPES.map((type) => (
                              <SelectItem key={type} value={type} className="cursor-pointer">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-edit-date">Date</Label>
                        <Input
                          id="dsp-edit-date"
                          type="date"
                          value={edit.disposal_date}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, disposal_date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-edit-book">Book value</Label>
                        <Input
                          id="dsp-edit-book"
                          type="number"
                          value={edit.book_value_at_disposal}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, book_value_at_disposal: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dsp-edit-proceeds">Proceeds</Label>
                        <Input
                          id="dsp-edit-proceeds"
                          type="number"
                          value={edit.proceeds_amount}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, proceeds_amount: e.target.value }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={actionLoading}
                          onClick={() => void saveDraft()}
                        >
                          Save draft
                        </Button>
                      </div>
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
