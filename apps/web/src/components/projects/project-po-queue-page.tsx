"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  FolderPlus,
  Loader2,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import {
  ProjectsErrorBanner,
  ProjectsListPanel,
  ProjectsListToolbar,
  ProjectsPage,
  ProjectsPageHeader,
} from "@/components/projects/projects-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  createCloudProjectFromHandoff,
  formatDate,
  listProjectManagementTeamOptions,
  listProjectPoQueue,
  type ProjectPoQueueItem,
} from "@/services/projects-portal-service";

type PoQueueRow = ProjectPoQueueItem & { id: string };

type CloudGroup = {
  key: string;
  name: string;
  rows: PoQueueRow[];
  poCount: number;
  circleCount: number;
  siteCount: number;
  /** Newest shared/created timestamp among lines — used for newest-first sort. */
  latestAt: string;
  /** Representative handoff used to create one project for this cloud. */
  createHandoffId: string;
};

function rowTimestamp(row: PoQueueRow): string {
  return row.shared_at || row.created_at || row.document_date || "";
}

function cloudKey(row: PoQueueRow): string {
  return (row.cloud_name || "Unassigned").trim().toLowerCase();
}

function createSharedHref(row: PoQueueRow): string {
  if (row.is_seed || !row.order_id) {
    return `/projects/projects/new?handoff_id=${row.handoff_id}&from_installation=1`;
  }
  return `/projects/projects/new?po_id=${row.order_id}&from_installation=1`;
}

function displayQueueQty(row: PoQueueRow): string {
  const rack = Number.parseInt(String(row.rack_quantity ?? "").trim() || "0", 10);
  const server = Number.parseInt(String(row.server_quantity ?? "").trim() || "0", 10);
  const total =
    (Number.isFinite(rack) ? Math.max(0, rack) : 0) +
    (Number.isFinite(server) ? Math.max(0, server) : 0);
  return total > 0 ? String(total) : "—";
}

function buildCloudGroups(rows: PoQueueRow[]): CloudGroup[] {
  const clouds = new Map<string, CloudGroup>();

  for (const row of rows) {
    if (!row.cloud_name?.trim()) {
      continue;
    }
    const cKey = cloudKey(row);
    const cName = row.cloud_name.trim();
    let cloud = clouds.get(cKey);
    if (!cloud) {
      cloud = {
        key: cKey,
        name: cName,
        rows: [],
        poCount: 0,
        circleCount: 0,
        siteCount: 0,
        latestAt: rowTimestamp(row),
        createHandoffId: row.handoff_id,
      };
      clouds.set(cKey, cloud);
    }
    cloud.rows.push(row);
    const ts = rowTimestamp(row);
    if (ts && ts > cloud.latestAt) {
      cloud.latestAt = ts;
      cloud.createHandoffId = row.handoff_id;
    }
  }

  for (const cloud of clouds.values()) {
    const circles = new Set(
      cloud.rows.map((r) => (r.circle_name || "").trim()).filter(Boolean),
    );
    const sites = new Set(
      cloud.rows.map((r) => (r.site_name || "").trim()).filter(Boolean),
    );
    const pos = new Set(
      cloud.rows
        .map((r) => (r.customer_po_number || r.company_po_number || "").trim())
        .filter(Boolean),
    );
    cloud.circleCount = circles.size;
    cloud.siteCount = sites.size;
    cloud.poCount = pos.size || cloud.rows.length;
    cloud.rows.sort((a, b) => {
      const byTime = rowTimestamp(b).localeCompare(rowTimestamp(a));
      if (byTime !== 0) return byTime;
      const po = (a.customer_po_number || "").localeCompare(b.customer_po_number || "");
      if (po !== 0) return po;
      return (a.line_type || "").localeCompare(b.line_type || "");
    });
  }

  // Newest clouds first (fresh tracker uploads / re-syncs rise to the top).
  return Array.from(clouds.values()).sort((a, b) => {
    const byTime = b.latestAt.localeCompare(a.latestAt);
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name);
  });
}

function matchesQuery(row: PoQueueRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.customer_po_number,
    row.company_po_number,
    row.document_number,
    row.customer_name,
    row.project_name,
    row.site_name,
    row.circle_name,
    row.cloud_name,
    row.line_type,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function ProjectPoQueuePage() {
  const router = useRouter();
  const [rows, setRows] = useState<PoQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCloudKey, setSelectedCloudKey] = useState<string | null>(null);
  const [creatingCloudKey, setCreatingCloudKey] = useState<string | null>(null);
  const [rfaiOpen, setRfaiOpen] = useState(false);
  const [rfaiNumber, setRfaiNumber] = useState("");
  const [rfaiBusy, setRfaiBusy] = useState(false);
  const [pmOptions, setPmOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedPmId, setSelectedPmId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [apiQueue, team] = await Promise.all([
        listProjectPoQueue(),
        listProjectManagementTeamOptions().catch(() => []),
      ]);
      setRows(
        apiQueue
          .map((row) => ({
            ...row,
            id: row.handoff_id || row.order_id || row.document_number,
          }))
          .sort((a, b) =>
            (b.shared_at || b.created_at || b.document_date || "").localeCompare(
              a.shared_at || a.created_at || a.document_date || "",
            ),
          ),
      );
      setPmOptions(Array.isArray(team) ? team : []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load purchase orders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesQuery(row, query)),
    [rows, query],
  );

  const cloudGroups = useMemo(() => buildCloudGroups(filtered), [filtered]);
  const sharedRows = useMemo(() => filtered.filter((row) => !row.cloud_name?.trim()), [filtered]);

  const selectedCloud = useMemo(
    () => cloudGroups.find((c) => c.key === selectedCloudKey) ?? null,
    [cloudGroups, selectedCloudKey],
  );

  useEffect(() => {
    if (selectedCloudKey && !cloudGroups.some((c) => c.key === selectedCloudKey)) {
      setSelectedCloudKey(null);
    }
  }, [cloudGroups, selectedCloudKey]);

  const createCloudProject = useCallback(
    async (cloud: CloudGroup, options?: { rfai_number?: string }) => {
      if (creatingCloudKey) return;
      const pmId = selectedPmId.trim();
      if (!pmId) {
        setError("Select a project manager before creating the project.");
        return;
      }
      setCreatingCloudKey(cloud.key);
      setError(null);
      try {
        const project = await createCloudProjectFromHandoff(cloud.createHandoffId, {
          ...options,
          project_manager_employee_id: pmId,
        });
        router.push(`/projects/projects/${project.id}`);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to create project for this cloud",
        );
        setCreatingCloudKey(null);
        setRfaiBusy(false);
      }
    },
    [creatingCloudKey, router, selectedPmId],
  );

  const submitRfai = useCallback(async () => {
    if (!selectedCloud) return;
    const number = rfaiNumber.trim();
    if (!number) {
      setError("Enter an RFAI number before creating the project.");
      return;
    }
    if (!selectedPmId.trim()) {
      setError("Select a project manager before creating the project.");
      return;
    }
    setRfaiBusy(true);
    await createCloudProject(selectedCloud, { rfai_number: number });
  }, [createCloudProject, rfaiNumber, selectedCloud, selectedPmId]);

  const cloudActions = (cloud: CloudGroup) => {
    const busy = creatingCloudKey === cloud.key;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 cursor-pointer"
          disabled={Boolean(creatingCloudKey)}
          onClick={() => {
            setError(null);
            setRfaiNumber("");
            setRfaiOpen(true);
          }}
        >
          <ClipboardCheck className="mr-1.5 size-3.5" aria-hidden />
          RFAI
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 shrink-0 cursor-pointer"
          disabled={Boolean(creatingCloudKey)}
          onClick={() => void createCloudProject(cloud)}
        >
          {busy && !rfaiBusy ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
          ) : (
            <FolderPlus className="mr-1.5 size-3.5" aria-hidden />
          )}
          {busy && !rfaiBusy ? "Creating…" : "Create Project"}
        </Button>
      </div>
    );
  };

  return (
    <ProjectsPage>
      <ProjectsPageHeader
        title="PO Queue"
        description="One project per cloud. Open a cloud to see every PO, or create the project directly."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 cursor-pointer"
            onClick={() => void load()}
            disabled={loading || Boolean(creatingCloudKey)}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      {selectedCloud ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="cursor-pointer rounded-sm px-1 py-0.5 transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setSelectedCloudKey(null);
                setRfaiOpen(false);
                setRfaiNumber("");
                setSelectedPmId("");
              }}
            >
              Clouds
            </button>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            <span className="px-1 py-0.5 font-medium text-foreground">{selectedCloud.name}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 cursor-pointer"
            onClick={() => {
              setSelectedCloudKey(null);
              setRfaiOpen(false);
              setRfaiNumber("");
              setSelectedPmId("");
            }}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </Button>
        </div>
      ) : null}

      {!selectedCloud ? (
        <ProjectsListPanel>
          <ProjectsListToolbar
            title="Clouds"
            subtitle={
              loading
                ? "Loading…"
                : `${cloudGroups.length} unique cloud${cloudGroups.length === 1 ? "" : "s"} · one project each`
            }
            icon={Cloud}
            count={cloudGroups.length}
            search={{
              value: query,
              onChange: setQuery,
              placeholder: "Search cloud, PO, circle, site, type…",
            }}
          />
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Loading purchase orders…
            </p>
          ) : cloudGroups.length === 0 && sharedRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No purchase orders awaiting project creation. Upload a tracker with Cloud / PO
              columns, or share an installation PO from Delivery.
            </p>
          ) : cloudGroups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tracker clouds yet. Shared installation POs are listed below.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {cloudGroups.map((cloud) => (
                <button
                  key={cloud.key}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
                  onClick={() => setSelectedCloudKey(cloud.key)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{cloud.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cloud.poCount} PO{cloud.poCount === 1 ? "" : "s"} · {cloud.circleCount}{" "}
                      circle{cloud.circleCount === 1 ? "" : "s"} · {cloud.siteCount} site
                      {cloud.siteCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </ProjectsListPanel>
      ) : null}

      {selectedCloud ? (
        <ProjectsListPanel>
          <ProjectsListToolbar
            title={selectedCloud.name}
            subtitle={`All POs for this cloud · ${selectedCloud.rows.length} line${selectedCloud.rows.length === 1 ? "" : "s"}`}
            icon={ShoppingCart}
            count={selectedCloud.poCount}
            actions={cloudActions(selectedCloud)}
            search={{
              value: query,
              onChange: setQuery,
              placeholder: "Filter PO, type, circle, site…",
            }}
          />
          <div className="border-b border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
            <div className="flex max-w-md flex-col gap-1.5">
              <label
                htmlFor="cloud-project-manager"
                className="text-xs font-medium text-foreground"
              >
                Project Manager
              </label>
              <FinanceSelect
                id="cloud-project-manager"
                value={selectedPmId}
                className="h-8"
                aria-label="Select project manager"
                disabled={rfaiBusy || Boolean(creatingCloudKey)}
                onChange={(event) => setSelectedPmId(event.target.value)}
              >
                <option value="">Select project manager…</option>
                {pmOptions.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label || pm.id}
                  </option>
                ))}
              </FinanceSelect>
            </div>
          </div>
          {rfaiOpen ? (
            <div className="border-b border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor="cloud-rfai-number" className="text-xs font-medium text-foreground">
                    RFAI Number
                  </label>
                  <Input
                    id="cloud-rfai-number"
                    value={rfaiNumber}
                    onChange={(event) => setRfaiNumber(event.target.value)}
                    placeholder="RFAI reference number…"
                    className="h-8"
                    disabled={rfaiBusy || Boolean(creatingCloudKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitRfai();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer"
                    disabled={rfaiBusy || Boolean(creatingCloudKey)}
                    onClick={() => {
                      setRfaiOpen(false);
                      setRfaiNumber("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 cursor-pointer"
                    disabled={rfaiBusy || Boolean(creatingCloudKey)}
                    onClick={() => void submitRfai()}
                  >
                    {rfaiBusy ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <ClipboardCheck className="mr-1.5 size-3.5" aria-hidden />
                    )}
                    {rfaiBusy ? "Creating…" : "Create with RFAI"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead className="border-b border-border/70 bg-muted/80 text-[11px] text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Project</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Circle</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Site</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Type</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Qty</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">PO</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">PO Date</th>
                </tr>
              </thead>
              <tbody>
                {selectedCloud.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="max-w-[180px] truncate px-3 py-2 font-medium">
                      {row.project_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{row.circle_name || "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2">{row.site_name || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {row.line_type || row.server_type || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {displayQueueQty(row)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {row.customer_po_number || row.company_po_number || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDate(row.document_date || row.shared_at || row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>
      ) : null}

      {!selectedCloud && sharedRows.length > 0 ? (
        <ProjectsListPanel>
          <ProjectsListToolbar
            title="Shared installation POs"
            subtitle="Delivery shares without a tracker cloud"
            icon={ShoppingCart}
            count={sharedRows.length}
          />
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead className="border-b border-border/70 bg-muted/80 text-[11px] text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Customer PO</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Site</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Circle</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Customer</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Shared</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sharedRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {row.customer_po_number || row.company_po_number || "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2">
                      {row.site_name || row.project_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{row.circle_name || "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2">{row.customer_name || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDate(row.shared_at || row.created_at || row.document_date)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Link
                        href={createSharedHref(row)}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "h-8 cursor-pointer",
                        )}
                      >
                        <FolderPlus className="mr-1.5 size-3.5" aria-hidden />
                        Create Project
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>
      ) : null}
    </ProjectsPage>
  );
}
