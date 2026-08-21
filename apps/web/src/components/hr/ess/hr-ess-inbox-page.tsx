"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, RefreshCw, Search, X } from "lucide-react";

import { HrAuthBanner, HrStatusBadge } from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import {
  INBOX_CATEGORY_LABELS,
  inboxItemHref,
  loadHrEssInbox,
  runInboxAction,
  type HrEssInboxCategory,
  type HrEssInboxItem,
} from "@/services/hr-ess-inbox-service";

type CategoryFilter = "all" | HrEssInboxCategory;

type StatusFilter =
  | "all"
  | "pending"
  | "submitted"
  | "approved"
  | "rejected";

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All Types" },
  { id: "leave", label: "Leave" },
  { id: "attendance_correction", label: "Attendance" },
  { id: "ot_allotment", label: "OT" },
  { id: "on_duty", label: "On Duty" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All Status" },
  { id: "pending", label: "Pending" },
  { id: "submitted", label: "Submitted" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function actionLabel(action: string): string {
  if (action === "manager-approve") return "Reporting manager approve";
  if (action === "approve") return "Approve";
  if (action === "reject") return "Reject";
  return action;
}

function matchesStatus(item: HrEssInboxItem, status: StatusFilter): boolean {
  const st = item.status.toLowerCase();
  if (status === "all") return true;
  if (status === "pending") return item.pending;
  if (status === "submitted") return st === "submitted";
  if (status === "approved") return st === "approved";
  if (status === "rejected") return st === "rejected";
  return true;
}

export function HrEssInboxPage() {
  const [items, setItems] = useState<HrEssInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadHrEssInbox());
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Failed to load ESS notifications",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!matchesStatus(item, status)) return false;
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
  }, [items, category, status, search]);

  const pendingCount = items.filter((i) => i.pending).length;
  const authBlocked = !isAuthenticated() && !loading && items.length === 0;

  async function onAction(item: HrEssInboxItem, action: string) {
    setActingId(item.id);
    try {
      await runInboxAction(item, action);
      toast(`${actionLabel(action)} — ${item.title}`, "success");
      await load();
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Action failed",
        "error",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader title="Employee Requests" />

      {authBlocked ? <HrAuthBanner /> : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, title, status…"
            className="h-9 pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
          <div className="flex items-center gap-1.5">
            <label htmlFor="ess-filter-type" className="sr-only">
              Notification type
            </label>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Type</span>
            <select
              id="ess-filter-type"
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="h-9 min-w-[9.5rem] cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs"
            >
              {CATEGORY_FILTERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="ess-filter-status" className="sr-only">
              Status
            </label>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Status</span>
            <select
              id="ess-filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-9 min-w-[9.5rem] cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs"
            >
              {STATUS_FILTERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === "pending" && pendingCount > 0
                    ? `${t.label} (${pendingCount})`
                    : t.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 cursor-pointer"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <EmsSkeleton rows={6} />
      ) : (
        <section className="rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-[11px] text-muted-foreground">
              Approve or reject pending items; decided items stay visible for 14 days
            </p>
          </div>
          <ul className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                No notifications match your filters.
              </li>
            ) : (
              filtered.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
                    item.pending && "bg-primary/[0.03]",
                  )}
                >
                  <Link
                    href={inboxItemHref(item)}
                    className="group min-w-0 flex-1 cursor-pointer space-y-1 rounded-lg outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring -mx-1 px-1 py-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {INBOX_CATEGORY_LABELS[item.category]}
                      </span>
                      <HrStatusBadge status={item.status} />
                      {!item.pending ? (
                        <span className="text-[10px] text-muted-foreground">Decided</span>
                      ) : null}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="text-xs text-muted-foreground">{item.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="text-[10px] text-muted-foreground/80">
                      {new Date(item.occurred_at).toLocaleString("en-IN")}
                    </p>
                  </Link>
                  {item.pending && item.available_actions.length > 0 ? (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {item.available_actions.map((action) => {
                        const isReject = action === "reject";
                        return (
                          <Button
                            key={action}
                            type="button"
                            size="sm"
                            variant={isReject ? "outline" : "default"}
                            className="cursor-pointer"
                            disabled={actingId === item.id}
                            onClick={() => void onAction(item, action)}
                          >
                            {isReject ? (
                              <X className="size-3.5" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                            {actionLabel(action)}
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
