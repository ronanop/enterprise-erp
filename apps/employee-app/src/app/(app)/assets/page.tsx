"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppHeader,
  FilterChips,
  SearchField,
} from "@/components/app-header";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssAsset } from "@/types/api";
import * as ui from "@/theme/classes";

const FILTERS = ["All Assets", "fixed", "consumable", "digital", "leased"];

export default function AssetsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All Assets");
  const [assets, setAssets] = useState<EssAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .assets()
      .then((res) => {
        if (!cancelled) setAssets(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "All Assets" && a.asset_type !== filter) return false;
      if (
        q &&
        !`${a.asset_name} ${a.asset_code} ${a.serial_number ?? ""}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [assets, query, filter]);

  return (
    <div className="space-y-5">
      <AppHeader title="My Assets" />

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search devices, serial numbers..."
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No assets assigned" />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/assets/${a.id}`}
                className={`${ui.card} flex items-center justify-between gap-3 p-4`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#0b1c30]">{a.asset_name}</p>
                  <p className="text-xs text-[#434655]">
                    {a.asset_code}
                    {a.serial_number ? ` · ${a.serial_number}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[#e5eeff] px-2.5 py-1 text-[10px] font-bold uppercase text-[#004ac6]">
                  {a.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AiFab />
    </div>
  );
}
