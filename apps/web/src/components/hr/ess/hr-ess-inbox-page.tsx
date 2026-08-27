"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  Check,
  CreditCard,
  Eye,
  Folder,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";

import { LeaveApprovalDrawer } from "@/components/hr/leave/leave-panels";
import { LeaveStatusBadge } from "@/components/hr/leave/leave-status-badge";
import { HrAuthBanner, HrEmptyState, HrToolbar } from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrmsPastelSurface } from "@/config/hrms-theme";
import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import {
  INBOX_CATEGORY_LABELS,
  loadHrEssInbox,
  runInboxAction,
  type HrEssInboxCategory,
  type HrEssInboxItem,
} from "@/services/hr-ess-inbox-service";
import { loadLeaveDirectory, type LeaveDirectory } from "@/services/leave-management-service";
import type { LeaveRequestRecord } from "@/types/leave-management";

const PAGE_SIZE = 12;

type RequestBucket = "attendance" | "on_tour" | "leaves" | "others";

const BUCKET_CATEGORIES: Record<RequestBucket, HrEssInboxCategory[]> = {
  attendance: ["attendance_correction"],
  on_tour: ["on_duty"],
  leaves: ["leave"],
  others: ["ot_allotment", "compoff"],
};

const CARDS: { id: RequestBucket; label: string; icon: LucideIcon }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarDays },
  { id: "on_tour", label: "On Tour", icon: Briefcase },
  { id: "leaves", label: "Leaves", icon: CreditCard },
  { id: "others", label: "Others", icon: Folder },
];

const TABLE_TITLES: Record<RequestBucket, string> = {
  attendance: "Attendance Requests",
  on_tour: "On Tour Requests",
  leaves: "Leave Requests",
  others: "Other Requests",
};

function bucketOf(category: HrEssInboxCategory): RequestBucket {
  if (category === "attendance_correction") return "attendance";
  if (category === "on_duty") return "on_tour";
  if (category === "leave") return "leaves";
  return "others";
}

function actionLabel(action: string): string {
  if (action === "manager-approve") return "Reporting manager approve";
  if (action === "approve") return "Approve";
  if (action === "reject") return "Reject";
  return action;
}

function parseEmployee(item: HrEssInboxItem): { name: string; code: string } {
  const raw = item.employee_name || "";
  const match = raw.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), code: match[2].trim() };
  return { name: raw || "—", code: "—" };
}

export function HrEssInboxPage() {
  const [items, setItems] = useState<HrEssInboxItem[]>([]);
  const [leaveDir, setLeaveDir] = useState<LeaveDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<RequestBucket>("attendance");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HrEssInboxItem | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bucketPicked, setBucketPicked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inbox, dir] = await Promise.all([
        loadHrEssInbox({ includeCompoff: true }),
        loadLeaveDirectory().catch(() => null),
      ]);
      setItems(inbox);
      if (dir) setLeaveDir(dir);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Failed to load employee requests",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingByBucket = useMemo(() => {
    const counts: Record<RequestBucket, number> = {
      attendance: 0,
      on_tour: 0,
      leaves: 0,
      others: 0,
    };
    for (const item of items) {
      if (!item.pending) continue;
      counts[bucketOf(item.category)] += 1;
    }
    return counts;
  }, [items]);

  useEffect(() => {
    if (loading || bucketPicked) return;
    const order: RequestBucket[] = ["attendance", "on_tour", "leaves", "others"];
    const firstWithPending = order.find((id) => pendingByBucket[id] > 0);
    if (firstWithPending) setBucket(firstWithPending);
    setBucketPicked(true);
  }, [loading, pendingByBucket, bucketPicked]);

  const pendingTotal = Object.values(pendingByBucket).reduce((sum, n) => sum + n, 0);

  const filtered = useMemo(() => {
    const allowed = new Set(BUCKET_CATEGORIES[bucket]);
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!allowed.has(item.category)) return false;
      if (!q) return true;
      const hay = [
        item.title,
        item.detail,
        item.employee_name,
        item.status,
        INBOX_CATEGORY_LABELS[item.category],
        item.document_number ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, bucket, search]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [bucket, search]);

  const selectedLeave: LeaveRequestRecord | null = useMemo(() => {
    if (!selected || selected.category !== "leave") return null;
    return leaveDir?.requests.find((r) => r.id === selected.source_id) ?? null;
  }, [selected, leaveDir]);

  const authBlocked = !isAuthenticated() && !loading && items.length === 0;

  function openView(item: HrEssInboxItem) {
    setSelected(item);
  }

  async function onGenericAction(item: HrEssInboxItem, action: string) {
    setActingId(item.id);
    try {
      await runInboxAction(item, action);
      toast(`${actionLabel(action)} — ${item.title}`, "success");
      setSelected(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <SetupToastHost />
      <PageHeader
        title="Employee Requests"
        actions={<HrToolbar onRefresh={() => void load()} loading={loading} />}
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && items.length === 0 ? <EmsSkeleton rows={6} /> : null}

      {!(loading && items.length === 0) ? (
        <>
          <section className="shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Team Pending Requests</h2>
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {pendingTotal > 99 ? "99+" : pendingTotal}
              </span>
            </div>
            <div className="grid auto-rows-fr grid-cols-2 gap-2.5 xl:grid-cols-4">
              {CARDS.map((card, index) => {
                const Icon = card.icon;
                const count = pendingByBucket[card.id];
                const active = bucket === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setBucket(card.id)}
                    className={cn(
                      "flex h-full min-h-[5rem] cursor-pointer flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-200",
                      hrmsPastelSurface(index),
                      active
                        ? "border-foreground/20 ring-2 ring-primary"
                        : "border-border hover:border-primary/30 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {card.label}
                      </p>
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                      {count.toLocaleString("en-IN")}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, title, status…"
                className="h-9 pl-8"
              />
            </div>
          </div>

          {!pageRows.length ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-card/40">
              <HrEmptyState
                title={`No ${TABLE_TITLES[bucket]}`}
                description="No requests match the current card and search."
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 px-4 py-2.5">
                  <h3 className="text-sm font-semibold">{TABLE_TITLES[bucket]}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click a row or View to open the same approval panel as leave requests
                  </p>
                </div>
                <div className="erp-scroll min-h-0 flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Employee
                        </th>
                        <th className="w-[88px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          ID
                        </th>
                        {!selected ? (
                          <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Type
                          </th>
                        ) : null}
                        <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Detail
                        </th>
                        {!selected ? (
                          <th className="w-[110px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Applied
                          </th>
                        ) : null}
                        <th className="w-[96px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Status
                        </th>
                        <th className="w-[72px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => {
                        const isOpen = selected?.id === row.id;
                        const emp = parseEmployee(row);
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-b border-border/40 cursor-pointer transition-colors",
                              isOpen
                                ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                                : "odd:bg-background even:bg-muted/20 hover:bg-muted/40",
                            )}
                            onClick={() => openView(row)}
                          >
                            <td className="truncate px-3 py-2 text-xs font-medium text-primary">
                              {emp.name}
                            </td>
                            <td className="truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                              {emp.code}
                            </td>
                            {!selected ? (
                              <td className="truncate px-3 py-2 text-xs">
                                {INBOX_CATEGORY_LABELS[row.category]}
                              </td>
                            ) : null}
                            <td className="max-w-[280px] truncate px-3 py-2 text-xs text-muted-foreground">
                              {row.detail || row.title}
                            </td>
                            {!selected ? (
                              <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                                {new Date(row.occurred_at).toLocaleDateString("en-IN")}
                              </td>
                            ) : null}
                            <td className="px-3 py-2">
                              <LeaveStatusBadge status={row.status} />
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 cursor-pointer px-2 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openView(row);
                                }}
                              >
                                <Eye className="size-3.5" />
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <EmsPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </div>

              {selected && selectedLeave ? (
                <div className="flex min-h-[22rem] w-full shrink-0 self-stretch lg:min-h-0 lg:w-auto">
                  <LeaveApprovalDrawer
                    open
                    request={selectedLeave}
                    onClose={() => setSelected(null)}
                    onDone={() => void load()}
                  />
                </div>
              ) : null}

              {selected && !selectedLeave ? (
                <div className="flex min-h-[22rem] w-full shrink-0 self-stretch lg:min-h-0 lg:w-auto">
                  <InboxRequestDrawer
                    item={selected}
                    acting={actingId === selected.id}
                    onClose={() => setSelected(null)}
                    onAction={(action) => void onGenericAction(selected, action)}
                  />
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function InboxRequestDrawer({
  item,
  acting,
  onClose,
  onAction,
}: {
  item: HrEssInboxItem;
  acting: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const emp = parseEmployee(item);
  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:w-[320px] xl:w-[340px]">
      <div className="flex items-start justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{emp.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {emp.code} · {INBOX_CATEGORY_LABELS[item.category]}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="erp-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <LeaveStatusBadge status={item.status} />
          {item.document_number ? (
            <span className="text-[11px] text-muted-foreground">{item.document_number}</span>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Request</dt>
          <dd className="font-medium">{item.title}</dd>
          <dt className="text-muted-foreground">Detail</dt>
          <dd>{item.detail || "—"}</dd>
          <dt className="text-muted-foreground">Applied</dt>
          <dd>{new Date(item.occurred_at).toLocaleString("en-IN")}</dd>
        </dl>
      </div>

      <div className="space-y-1.5 border-t border-border/70 px-3 py-2.5">
        {item.pending && item.available_actions.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {item.available_actions.map((action) => {
              const isReject = action === "reject";
              return (
                <Button
                  key={action}
                  type="button"
                  size="sm"
                  variant={isReject ? "destructive" : "default"}
                  className="h-8 cursor-pointer text-xs"
                  disabled={acting}
                  onClick={() => onAction(action)}
                >
                  {isReject ? <X className="size-3.5" /> : <Check className="size-3.5" />}
                  {actionLabel(action)}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No pending approval actions.</p>
        )}
      </div>
    </aside>
  );
}
