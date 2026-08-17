"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

import { listCrmApprovalInbox, type CrmApprovalInboxItem } from "@/services/sales-crm-service";
import { cn } from "@/lib/utils";
import {
  dismissCrmApproval,
  normalizeNotificationText,
  readDismissedCrmApprovalIds,
} from "@/lib/crm-notification-state";

function entityHref(entityType: string, entityId: string): string {
  if (entityType === "opportunity") return `/crm/opportunities/${entityId}`;
  if (entityType === "quote") return `/crm/quotes/${entityId}`;
  if (entityType === "ovf") return `/crm/ovf/${entityId}`;
  return "/crm/my-jobs";
}

function parseOpenEntity(pathname: string): { type: string; id: string } | null {
  const opp = pathname.match(/^\/crm\/opportunities\/([^/]+)/);
  if (opp?.[1]) return { type: "opportunity", id: opp[1] };
  const quote = pathname.match(/^\/crm\/quotes\/([^/]+)/);
  if (quote?.[1]) return { type: "quote", id: quote[1] };
  const ovf = pathname.match(/^\/crm\/ovf\/([^/]+)/);
  if (ovf?.[1]) return { type: "ovf", id: ovf[1] };
  return null;
}

/** Routes that mount the fixed 220px company/opportunity secondary rail. */
function hasCompanySecondaryRail(pathname: string): boolean {
  return pathname.startsWith("/crm/companies/") || pathname.startsWith("/crm/opportunities/");
}

function alertEntity(row: CrmApprovalInboxItem): { type: string; id: string } {
  return {
    type: String(row.payload_json?.entity_type ?? ""),
    id: String(row.payload_json?.entity_id ?? ""),
  };
}

function isSameEntity(
  row: CrmApprovalInboxItem,
  open: { type: string; id: string } | null,
): boolean {
  if (!open) return false;
  const entity = alertEntity(row);
  return entity.type === open.type && entity.id === open.id;
}

export function CrmRejectionAlertCard({
  title,
  body,
  href,
  onDismiss,
  showOpenRecord = true,
  className,
}: {
  title: string;
  body: string;
  href?: string;
  onDismiss?: () => void;
  showOpenRecord?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm",
        className,
      )}
      role="status"
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 wrap-break-word">
          <span className="font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-amber-900/90">{body}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {showOpenRecord && href ? (
          <Link
            href={href}
            className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-amber-400/60 bg-white px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-amber-100/80"
            onClick={onDismiss}
          >
            Open record
          </Link>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss alert"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border border-amber-400/40 bg-white text-amber-900 transition-colors duration-200 hover:bg-amber-100/80"
            onClick={onDismiss}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Inline rejection notice for the open opportunity / quote / OVF record. */
export function CrmEntityRejectionAlert({
  entityType,
  entityId,
}: {
  entityType: "opportunity" | "quote" | "ovf";
  entityId: string;
}) {
  const [alert, setAlert] = useState<CrmApprovalInboxItem | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listCrmApprovalInbox();
        const match = rows.find((row) => {
          if (row.event_type !== "crm.approval.rejected") return false;
          const entity = alertEntity(row);
          return entity.type === entityType && entity.id === entityId;
        });
        if (!cancelled) {
          const dismissed = match ? readDismissedCrmApprovalIds().has(match.id) : false;
          setAlert(match && !dismissed ? match : null);
        }
      } catch {
        if (!cancelled) setAlert(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (dismissed || !alert) return null;

  const title = normalizeNotificationText(String(alert.payload_json?.title ?? "Approval rejected"));
  const body = normalizeNotificationText(String(alert.payload_json?.body ?? "Please review and re-attach the document."));

  return (
    <CrmRejectionAlertCard
      title={title}
      body={body}
      showOpenRecord={false}
      onDismiss={() => {
        dismissCrmApproval(alert.id);
        setDismissed(true);
      }}
    />
  );
}

export function CrmApprovalInboxListener() {
  const pathname = usePathname() ?? "";
  const [alerts, setAlerts] = useState<CrmApprovalInboxItem[]>([]);
  const openEntity = useMemo(() => parseOpenEntity(pathname), [pathname]);
  const companyRail = hasCompanySecondaryRail(pathname);

  const poll = useCallback(async () => {
    try {
      const rows = await listCrmApprovalInbox();
      const seen = readDismissedCrmApprovalIds();
      const open = parseOpenEntity(window.location.pathname);
      const rejections = rows.filter((row) => {
        if (row.event_type !== "crm.approval.rejected" || seen.has(row.id)) return false;
        // Matching open record is handled by CrmEntityRejectionAlert.
        if (isSameEntity(row, open)) {
          return false;
        }
        return true;
      });
      setAlerts(rejections.slice(0, 3));
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 20_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  // Drop floating alerts for the entity currently on screen (inline banner owns them).
  useEffect(() => {
    if (!openEntity) return;
    setAlerts((prev) => {
      const matched = prev.filter((row) => isSameEntity(row, openEntity));
      if (matched.length === 0) return prev;
      return prev.filter((row) => !isSameEntity(row, openEntity));
    });
  }, [openEntity]);

  if (alerts.length === 0) return null;

  return (
    <div
      className={cn(
        "min-w-0 space-y-2",
        // Clear the fixed company/opportunity secondary rail (220px).
        companyRail && "pl-51 sm:pl-49 lg:pl-47",
      )}
    >
      {alerts.map((row) => {
        const title = normalizeNotificationText(String(row.payload_json?.title ?? "Approval rejected"));
        const body = normalizeNotificationText(String(row.payload_json?.body ?? "Please review and re-attach the document."));
        const entity = alertEntity(row);
        const href = entityHref(entity.type, entity.id);
        return (
          <CrmRejectionAlertCard
            key={row.id}
            title={title}
            body={body}
            href={href}
            onDismiss={() => {
              dismissCrmApproval(row.id);
              setAlerts((prev) => prev.filter((item) => item.id !== row.id));
            }}
          />
        );
      })}
    </div>
  );
}
