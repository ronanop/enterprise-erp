"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssSupportTicket } from "@/types/api";
import * as ui from "@/theme/classes";

function kindLabel(kind: string): string {
  if (kind === "grievance") return "Grievance";
  if (kind === "asset") return "Asset";
  return "IT / Help";
}

export default function SupportTicketsPage() {
  const [items, setItems] = useState<EssSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    essService
      .supportTickets()
      .then((res) => {
        if (!cancelled) setItems(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <AppHeader title="Help & tickets" />

      <Link
        href="/support/new"
        className={`${ui.btn} block text-center`}
      >
        New ticket
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/support/new?kind=it" className={`${ui.card} p-3 text-center text-sm font-semibold text-[#004ac6]`}>
          IT support
        </Link>
        <Link
          href="/support/new?kind=grievance"
          className={`${ui.card} p-3 text-center text-sm font-semibold text-[#712ae2]`}
        >
          Grievance
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="No tickets yet" description="Raise IT or HR grievance requests here." />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link href={`/support/${t.id}`} className={`${ui.card} block p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0b1c30]">{t.subject}</p>
                    <p className="text-xs text-[#434655]">
                      {t.document_number} · {kindLabel(t.kind)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e5eeff] px-2 py-0.5 text-[10px] font-bold uppercase text-[#004ac6]">
                    {t.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AiFab />
    </div>
  );
}
