"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { listCrmApprovalInbox, type CrmApprovalInboxItem } from "@/services/sales-crm-service";

const SEEN_KEY = "crm_approval_inbox_seen";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
}

export function CrmApprovalInboxListener() {
  const [alerts, setAlerts] = useState<CrmApprovalInboxItem[]>([]);

  const poll = useCallback(async () => {
    try {
      const rows = await listCrmApprovalInbox();
      const rejections = rows.filter((row) => row.event_type === "crm.approval.rejected");
      const seen = readSeen();
      const fresh = rejections.filter((row) => !seen.has(row.id));
      if (fresh.length > 0) {
        for (const row of fresh) seen.add(row.id);
        writeSeen(seen);
      }
      setAlerts(fresh.slice(0, 3));
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 20_000);
    return () => window.clearInterval(timer);
  }, [poll]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((row) => {
        const title = String(row.payload_json?.title ?? "Approval rejected");
        const body = String(row.payload_json?.body ?? "Please review and re-attach the document.");
        const entityType = String(row.payload_json?.entity_type ?? "");
        const entityId = String(row.payload_json?.entity_id ?? "");
        const href =
          entityType === "opportunity"
            ? `/crm/opportunities/${entityId}`
            : entityType === "quote"
              ? `/crm/quotes/${entityId}`
              : entityType === "ovf"
                ? `/crm/ovf/${entityId}`
                : "/crm/my-jobs";
        return (
          <div
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm"
            role="status"
          >
            <span className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{title}</span>
                <span className="mt-0.5 block text-xs text-amber-900/90">{body}</span>
              </span>
            </span>
            <Link
              href={href}
              className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-lg border border-amber-400/60 bg-white px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-amber-100/80"
            >
              Open record
            </Link>
          </div>
        );
      })}
    </div>
  );
}
