"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppHeader,
  FilterChips,
} from "@/components/app-header";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssAnnouncement } from "@/types/api";
import * as ui from "@/theme/classes";

const FILTERS = ["All", "News", "Events", "Policy"];

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState<EssAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .announcements()
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

  const pinned = items.find((a) => a.pinned);
  const latest = useMemo(() => {
    return items.filter((a) => {
      if (a.pinned) return false;
      if (filter === "All") return true;
      return a.tag.toLowerCase().includes(filter.toLowerCase());
    });
  }, [items, filter]);

  return (
    <div className="space-y-5">
      <AppHeader title="Announcements" />

      <div className="flex items-center justify-between gap-2">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <NotificationBellLink />
      </div>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <>
          {pinned ? (
            <div className={`${ui.card} space-y-2 border-[#004ac6]/20 p-4`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#004ac6]">
                Pinned · {pinned.tag}
              </p>
              <p className="font-semibold text-[#0b1c30]">{pinned.title}</p>
              <p className="text-sm text-[#434655]">{pinned.body}</p>
            </div>
          ) : null}
          <ul className="space-y-3">
            {latest.map((a) => (
              <li key={a.id} className={`${ui.card} space-y-1 p-4`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#004ac6]">
                  {a.tag}
                  {a.published_on ? ` · ${a.published_on}` : ""}
                </p>
                <p className="font-semibold text-[#0b1c30]">{a.title}</p>
                <p className="text-sm text-[#434655]">{a.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <AiFab />
    </div>
  );
}
