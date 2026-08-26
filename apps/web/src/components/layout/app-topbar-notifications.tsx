"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  dismissCrmApproval,
  normalizeNotificationText,
  readDismissedCrmApprovalIds,
} from "@/lib/crm-notification-state";
import {
  listPoApprovalDecisionNotifications,
  listUnreadPoApprovalDecisionNotifications,
  markAllPoApprovalDecisionNotificationsRead,
  markPoApprovalDecisionNotificationRead,
  PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT,
  type PoApprovalDecisionNotification,
} from "@/lib/procurement-approval-notifications";
import { cn } from "@/lib/utils";
import {
  listCrmApprovalInbox,
  type CrmApprovalInboxItem,
} from "@/services/sales-crm-service";
import {
  listScmQueue,
  type ScmQueueItem,
} from "@/services/procurement-service";
import {
  listProjectStageSaveAlerts,
  markProjectStageSaveAlertRead,
  type ProjectStageSaveAlert,
} from "@/services/projects-portal-service";
import { getUnseenScmOvfIds, markScmQueueSeen } from "@/utils/scm-queue-seen";

const PROJECT_SEEN_POPUP_KEY = "prj_stage_save_alert_popup_seen";
const CRM_SEEN_POPUP_KEY = "crm_approval_popup_seen";
const PROC_SEEN_POPUP_KEY = "proc_notification_popup_seen";
const POLL_MS = 20_000;
const PANEL_WIDTH = 352;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 8;

type NotificationMode = "projects" | "crm" | "procurement" | "none";

type CrmBellItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  created_at: string | null;
  unread: boolean;
};

type ProcBellItem = {
  id: string;
  kind: "scm" | "approval";
  title: string;
  body: string;
  href: string;
  created_at: string | null;
  unread: boolean;
  ovfId?: string;
};

function resolveMode(pathname: string): NotificationMode {
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return "projects";
  if (pathname === "/crm" || pathname.startsWith("/crm/")) return "crm";
  if (pathname === "/procurement" || pathname.startsWith("/procurement/")) {
    return "procurement";
  }
  return "none";
}

function readIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  sessionStorage.setItem(key, JSON.stringify([...ids].slice(-200)));
}

function formatSavedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function crmEntityHref(entityType: string, entityId: string): string {
  if (entityType === "opportunity") return `/crm/opportunities/${entityId}`;
  if (entityType === "quote") return `/crm/quotes/${entityId}`;
  if (entityType === "ovf") return `/crm/ovf/${entityId}`;
  return "/crm/my-jobs";
}

function mapCrmInboxItem(row: CrmApprovalInboxItem): CrmBellItem {
  const payload = row.payload_json ?? {};
  const entityType = String(payload.entity_type ?? "");
  const entityId = String(payload.entity_id ?? "");
  return {
    id: row.id,
    title: normalizeNotificationText(String(payload.title ?? "CRM approval update")),
    body: normalizeNotificationText(
      String(payload.body ?? "Open the related record to review."),
    ),
    href: crmEntityHref(entityType, entityId),
    created_at: row.created_at,
    unread: true,
  };
}

function mapScmQueueItem(row: ScmQueueItem): ProcBellItem {
  const customer =
    (row.customer_name || row.account_name || "").trim() || "Customer";
  return {
    id: `scm:${row.ovf_id}`,
    kind: "scm",
    title: `New SCM queue · ${row.ovf_no || "OVF"}`,
    body: `${customer}${row.oem_name ? ` · ${row.oem_name}` : ""} — open queue to create PO.`,
    href: "/procurement/scm",
    created_at: row.received_at ?? null,
    unread: true,
    ovfId: row.ovf_id,
  };
}

function mapApprovalNotification(row: PoApprovalDecisionNotification): ProcBellItem {
  const po = row.companyPoNumber?.trim() || row.documentNumber || "PO";
  return {
    id: `approval:${row.id}`,
    kind: "approval",
    title: row.decision === "accepted" ? `PO accepted · ${po}` : `PO rejected · ${po}`,
    body: row.message,
    href: `/procurement/orders/${row.orderId}`,
    created_at: row.createdAt,
    unread: !row.read,
  };
}

function anchorBelowBell(trigger: HTMLElement | null): { top: number; left: number } | null {
  if (!trigger || typeof window === "undefined") return null;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  let left = rect.right - width;
  left = Math.min(
    Math.max(VIEWPORT_PAD, left),
    window.innerWidth - width - VIEWPORT_PAD,
  );
  const top = Math.min(
    rect.bottom + PANEL_GAP,
    window.innerHeight - VIEWPORT_PAD - 120,
  );
  return { top, left };
}

function ProjectAlertBody({ alert }: { alert: ProjectStageSaveAlert }) {
  return (
    <div className="min-w-0 space-y-1 text-left">
      <p className="text-sm font-medium text-foreground">
        {alert.stage_label} — {alert.progress_status_label}
      </p>
      <p className="text-xs text-muted-foreground">
        {alert.site_name || alert.document_number || "Site"} · {alert.project_name || "Project"}
      </p>
      <p className="text-xs text-muted-foreground">
        By {alert.actor_name} · {formatSavedAt(alert.saved_at)}
      </p>
      {alert.remarks ? (
        <p className="text-xs text-foreground/90">
          <span className="font-medium">Remarks:</span> {alert.remarks}
        </p>
      ) : null}
      {alert.no_answers.length > 0 ? (
        <p className="text-xs text-foreground/90">
          <span className="font-medium">Marked No:</span> {alert.no_answers.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function CrmAlertBody({ item }: { item: CrmBellItem }) {
  return (
    <div className="min-w-0 space-y-1 text-left">
      <p className="text-sm font-medium text-foreground">{item.title}</p>
      <p className="text-xs text-foreground/90 wrap-break-word">{item.body}</p>
      <p className="text-xs text-muted-foreground">{formatSavedAt(item.created_at)}</p>
    </div>
  );
}

function ProcAlertBody({ item }: { item: ProcBellItem }) {
  return (
    <div className="min-w-0 space-y-1 text-left">
      <p className="text-sm font-medium text-foreground">{item.title}</p>
      <p className="text-xs text-foreground/90 wrap-break-word">{item.body}</p>
      <p className="text-xs text-muted-foreground">{formatSavedAt(item.created_at)}</p>
    </div>
  );
}

const bellTriggerClassName = cn(
  "relative size-9 cursor-pointer rounded-md border border-border bg-card text-foreground",
  "transition-colors duration-200 hover:bg-muted hover:text-foreground",
  "aria-expanded:bg-muted",
);

export function AppTopbarNotifications() {
  const pathname = usePathname() ?? "";
  const mode = resolveMode(pathname);
  const { signedIn, projectModuleAdmin, loading: authLoading } = useAuthUser();

  const [open, setOpen] = useState(false);
  const [projectAlerts, setProjectAlerts] = useState<ProjectStageSaveAlert[]>([]);
  const [projectPopups, setProjectPopups] = useState<ProjectStageSaveAlert[]>([]);
  const [crmAlerts, setCrmAlerts] = useState<CrmBellItem[]>([]);
  const [crmPopups, setCrmPopups] = useState<CrmBellItem[]>([]);
  const [procAlerts, setProcAlerts] = useState<ProcBellItem[]>([]);
  const [procPopups, setProcPopups] = useState<ProcBellItem[]>([]);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inboxRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const projectsEnabled = mode === "projects" && signedIn && projectModuleAdmin;
  const crmEnabled = mode === "crm" && signedIn;
  const procurementEnabled = mode === "procurement" && signedIn;
  const enabled = projectsEnabled || crmEnabled || procurementEnabled;

  const unreadCount = useMemo(() => {
    if (mode === "projects") return projectAlerts.filter((a) => a.unread).length;
    if (mode === "crm") return crmAlerts.filter((a) => a.unread).length;
    if (mode === "procurement") return procAlerts.filter((a) => a.unread).length;
    return 0;
  }, [mode, projectAlerts, crmAlerts, procAlerts]);

  const popupCount =
    mode === "projects"
      ? projectPopups.length
      : mode === "crm"
        ? crmPopups.length
        : mode === "procurement"
          ? procPopups.length
          : 0;

  const updatePosition = useCallback(() => {
    setCoords(anchorBelowBell(triggerRef.current));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    if (mode !== "projects") {
      setProjectAlerts([]);
      setProjectPopups([]);
    }
    if (mode !== "crm") {
      setCrmAlerts([]);
      setCrmPopups([]);
    }
    if (mode !== "procurement") {
      setProcAlerts([]);
      setProcPopups([]);
    }
  }, [mode]);

  const pollProjects = useCallback(async () => {
    if (!projectsEnabled) {
      setProjectAlerts([]);
      setProjectPopups([]);
      return;
    }
    try {
      const rows = await listProjectStageSaveAlerts(40);
      setProjectAlerts(rows);
      const seen = readIdSet(PROJECT_SEEN_POPUP_KEY);
      const fresh = rows.filter((row) => row.unread && !seen.has(row.id));
      if (fresh.length > 0) {
        for (const row of fresh) seen.add(row.id);
        writeIdSet(PROJECT_SEEN_POPUP_KEY, seen);
        setProjectPopups(fresh.slice(0, 3));
      }
    } catch {
      /* ignore polling errors */
    }
  }, [projectsEnabled]);

  const pollCrm = useCallback(async () => {
    if (!crmEnabled) {
      setCrmAlerts([]);
      setCrmPopups([]);
      return;
    }
    try {
      const rows = await listCrmApprovalInbox();
      const dismissed = readDismissedCrmApprovalIds();
      const mapped = rows
        .filter((row) => !dismissed.has(row.id))
        .slice(0, 40)
        .map(mapCrmInboxItem);
      setCrmAlerts(mapped);
      const popupSeen = readIdSet(CRM_SEEN_POPUP_KEY);
      const fresh = mapped.filter((row) => !popupSeen.has(`crm:${row.id}`));
      if (fresh.length > 0) {
        for (const row of fresh) popupSeen.add(`crm:${row.id}`);
        writeIdSet(CRM_SEEN_POPUP_KEY, popupSeen);
        setCrmPopups(fresh.slice(0, 3));
      }
    } catch {
      /* ignore polling errors */
    }
  }, [crmEnabled]);

  const pollProcurement = useCallback(async () => {
    if (!procurementEnabled) {
      setProcAlerts([]);
      setProcPopups([]);
      return;
    }
    try {
      const queue = await listScmQueue().catch(() => [] as ScmQueueItem[]);
      const unseenIds = new Set(getUnseenScmOvfIds(queue.map((r) => r.ovf_id)));
      const scmItems = queue
        .filter((row) => unseenIds.has(row.ovf_id))
        .map(mapScmQueueItem);
      const approvalItems = listPoApprovalDecisionNotifications()
        .slice(0, 40)
        .map(mapApprovalNotification);
      const mapped = [...scmItems, ...approvalItems].sort((a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      );
      setProcAlerts(mapped);

      const popupSeen = readIdSet(PROC_SEEN_POPUP_KEY);
      const freshUnread = [
        ...scmItems,
        ...listUnreadPoApprovalDecisionNotifications().map(mapApprovalNotification),
      ].filter((row) => row.unread && !popupSeen.has(row.id));
      if (freshUnread.length > 0) {
        for (const row of freshUnread) popupSeen.add(row.id);
        writeIdSet(PROC_SEEN_POPUP_KEY, popupSeen);
        setProcPopups(freshUnread.slice(0, 3));
      }
    } catch {
      /* ignore polling errors */
    }
  }, [procurementEnabled]);

  useEffect(() => {
    if (authLoading) return;
    if (mode === "projects") {
      void pollProjects();
      if (!projectsEnabled) return;
      const timer = window.setInterval(() => void pollProjects(), POLL_MS);
      return () => window.clearInterval(timer);
    }
    if (mode === "crm") {
      void pollCrm();
      if (!crmEnabled) return;
      const timer = window.setInterval(() => void pollCrm(), POLL_MS);
      return () => window.clearInterval(timer);
    }
    if (mode === "procurement") {
      void pollProcurement();
      if (!procurementEnabled) return;
      const timer = window.setInterval(() => void pollProcurement(), POLL_MS);
      const onProcChange = () => void pollProcurement();
      window.addEventListener("focus", onProcChange);
      window.addEventListener("erp:scm-queue-seen", onProcChange);
      window.addEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, onProcChange);
      return () => {
        window.clearInterval(timer);
        window.removeEventListener("focus", onProcChange);
        window.removeEventListener("erp:scm-queue-seen", onProcChange);
        window.removeEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, onProcChange);
      };
    }
  }, [
    authLoading,
    mode,
    projectsEnabled,
    crmEnabled,
    procurementEnabled,
    pollProjects,
    pollCrm,
    pollProcurement,
  ]);

  useLayoutEffect(() => {
    if (!open && popupCount === 0) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, popupCount, updatePosition]);

  useEffect(() => {
    if (!open && popupCount === 0) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, popupCount, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        inboxRef.current?.contains(target) ||
        toastRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMarkProjectRead = useCallback(async (id: string) => {
    try {
      await markProjectStageSaveAlertRead(id);
      setProjectAlerts((prev) =>
        prev.map((row) => (row.id === id ? { ...row, unread: false } : row)),
      );
      setProjectPopups((prev) => prev.filter((row) => row.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  const onMarkAllProjectRead = useCallback(async () => {
    const unread = projectAlerts.filter((a) => a.unread);
    await Promise.all(unread.map((row) => onMarkProjectRead(row.id)));
  }, [projectAlerts, onMarkProjectRead]);

  const onMarkCrmRead = useCallback((id: string) => {
    dismissCrmApproval(id);
    setCrmAlerts((prev) => prev.filter((row) => row.id !== id));
    setCrmPopups((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const onMarkAllCrmRead = useCallback(() => {
    for (const row of crmAlerts) {
      dismissCrmApproval(row.id);
    }
    setCrmAlerts([]);
    setCrmPopups([]);
  }, [crmAlerts]);

  const onMarkProcRead = useCallback((item: ProcBellItem) => {
    if (item.kind === "scm" && item.ovfId) {
      markScmQueueSeen([item.ovfId]);
    }
    if (item.kind === "approval") {
      const rawId = item.id.replace(/^approval:/, "");
      markPoApprovalDecisionNotificationRead(rawId);
    }
    setProcAlerts((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, unread: false } : row)),
    );
    setProcPopups((prev) => prev.filter((row) => row.id !== item.id));
    // Drop SCM rows once seen so count matches sidebar badge.
    if (item.kind === "scm") {
      setProcAlerts((prev) => prev.filter((row) => row.id !== item.id));
    }
  }, []);

  const onMarkAllProcRead = useCallback(() => {
    const scmIds = procAlerts
      .filter((row) => row.kind === "scm" && row.ovfId)
      .map((row) => row.ovfId!);
    if (scmIds.length) markScmQueueSeen(scmIds);
    markAllPoApprovalDecisionNotificationsRead();
    setProcAlerts((prev) =>
      prev
        .filter((row) => row.kind !== "scm")
        .map((row) => ({ ...row, unread: false })),
    );
    setProcPopups([]);
  }, [procAlerts]);

  if (!enabled) {
    return (
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Notifications"
        disabled
        className="size-9 rounded-md border-border text-muted-foreground"
      >
        <Bell className="size-4" />
      </Button>
    );
  }

  const panelWidth = Math.min(
    PANEL_WIDTH,
    typeof window !== "undefined" ? window.innerWidth - VIEWPORT_PAD * 2 : PANEL_WIDTH,
  );

  const inboxTitle =
    mode === "crm"
      ? "CRM updates"
      : mode === "procurement"
        ? "Procurement updates"
        : "Stage updates";
  const inboxEmpty =
    mode === "crm"
      ? "No CRM approval alerts yet."
      : mode === "procurement"
        ? "No SCM queue or PO approval alerts."
        : "No stage save alerts yet.";
  const dialogLabel =
    mode === "crm"
      ? "CRM notifications"
      : mode === "procurement"
        ? "Procurement notifications"
        : "Stage save notifications";

  const inbox =
    mounted && open && coords
      ? createPortal(
          <div
            ref={inboxRef}
            role="dialog"
            aria-label={dialogLabel}
            className="fixed z-80 overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
            style={{
              top: coords.top,
              left: coords.left,
              width: panelWidth,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
              <p className="text-sm font-semibold">{inboxTitle}</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                  onClick={() => {
                    if (mode === "crm") onMarkAllCrmRead();
                    else if (mode === "procurement") onMarkAllProcRead();
                    else void onMarkAllProjectRead();
                  }}
                >
                  <CheckCheck className="size-3.5" aria-hidden />
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="erp-scroll max-h-[min(70vh,24rem)] overflow-y-auto">
              {mode === "crm" ? (
                crmAlerts.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {inboxEmpty}
                  </li>
                ) : (
                  crmAlerts.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "border-b border-border/50 px-3 py-2.5 last:border-b-0",
                        item.unread && "bg-muted/40",
                      )}
                    >
                      <CrmAlertBody item={item} />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={item.href}
                          className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted"
                          onClick={() => {
                            setOpen(false);
                            if (item.unread) onMarkCrmRead(item.id);
                          }}
                        >
                          Open record
                        </Link>
                        {item.unread ? (
                          <button
                            type="button"
                            className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                            onClick={() => onMarkCrmRead(item.id)}
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )
              ) : mode === "procurement" ? (
                procAlerts.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {inboxEmpty}
                  </li>
                ) : (
                  procAlerts.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "border-b border-border/50 px-3 py-2.5 last:border-b-0",
                        item.unread && "bg-muted/40",
                      )}
                    >
                      <ProcAlertBody item={item} />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={item.href}
                          className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted"
                          onClick={() => {
                            setOpen(false);
                            if (item.unread) onMarkProcRead(item);
                          }}
                        >
                          {item.kind === "scm" ? "Open SCM queue" : "Open PO"}
                        </Link>
                        {item.unread ? (
                          <button
                            type="button"
                            className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                            onClick={() => onMarkProcRead(item)}
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )
              ) : projectAlerts.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {inboxEmpty}
                </li>
              ) : (
                projectAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={cn(
                      "border-b border-border/50 px-3 py-2.5 last:border-b-0",
                      alert.unread && "bg-muted/40",
                    )}
                  >
                    <ProjectAlertBody alert={alert} />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href={alert.form_path}
                        className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted"
                        onClick={() => {
                          setOpen(false);
                          if (alert.unread) void onMarkProjectRead(alert.id);
                        }}
                      >
                        Open stage
                      </Link>
                      {alert.unread ? (
                        <button
                          type="button"
                          className="inline-flex h-7 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                          onClick={() => void onMarkProjectRead(alert.id)}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  const toastStack =
    mounted && popupCount > 0 && coords && !open
      ? createPortal(
          <div
            ref={toastRef}
            className="fixed z-80 flex flex-col gap-2"
            style={{
              top: coords.top,
              left: coords.left,
              width: panelWidth,
            }}
          >
            {mode === "crm"
              ? crmPopups.map((item) => (
                  <div
                    key={`popup-${item.id}`}
                    role="status"
                    className="rounded-xl border border-border/80 bg-card p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CrmAlertBody item={item} />
                      <button
                        type="button"
                        aria-label="Dismiss notification"
                        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          setCrmPopups((prev) => prev.filter((row) => row.id !== item.id));
                          if (item.unread) onMarkCrmRead(item.id);
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2">
                      <Link
                        href={item.href}
                        className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                        onClick={() => {
                          setCrmPopups((prev) => prev.filter((row) => row.id !== item.id));
                          if (item.unread) onMarkCrmRead(item.id);
                        }}
                      >
                        Open record
                      </Link>
                    </div>
                  </div>
                ))
              : mode === "procurement"
                ? procPopups.map((item) => (
                    <div
                      key={`popup-${item.id}`}
                      role="status"
                      className="rounded-xl border border-border/80 bg-card p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <ProcAlertBody item={item} />
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            setProcPopups((prev) =>
                              prev.filter((row) => row.id !== item.id),
                            );
                            if (item.unread) onMarkProcRead(item);
                          }}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2">
                        <Link
                          href={item.href}
                          className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                          onClick={() => {
                            setProcPopups((prev) =>
                              prev.filter((row) => row.id !== item.id),
                            );
                            if (item.unread) onMarkProcRead(item);
                          }}
                        >
                          {item.kind === "scm" ? "Open SCM queue" : "Open PO"}
                        </Link>
                      </div>
                    </div>
                  ))
                : projectPopups.map((alert) => (
                    <div
                      key={`popup-${alert.id}`}
                      role="status"
                      className="rounded-xl border border-border/80 bg-card p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <ProjectAlertBody alert={alert} />
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            setProjectPopups((prev) =>
                              prev.filter((row) => row.id !== alert.id),
                            );
                            if (alert.unread) void onMarkProjectRead(alert.id);
                          }}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2">
                        <Link
                          href={alert.form_path}
                          className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                          onClick={() => {
                            setProjectPopups((prev) =>
                              prev.filter((row) => row.id !== alert.id),
                            );
                            if (alert.unread) void onMarkProjectRead(alert.id);
                          }}
                        >
                          Open stage
                        </Link>
                      </div>
                    </div>
                  ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <div ref={triggerRef}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          className={bellTriggerClassName}
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-slate-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </div>
      {inbox}
      {toastStack}
    </div>
  );
}
