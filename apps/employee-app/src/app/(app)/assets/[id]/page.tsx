"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { essService } from "@/services/ess-service";
import type { EssAssetDetail } from "@/types/api";
import * as ui from "@/theme/classes";

export default function AssetDetailsPage() {
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<EssAssetDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .asset(params.id)
      .then((res) => {
        if (!cancelled) setAsset(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setAsset(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="space-y-5 pb-28">
      <SubHeader title="Asset Details" backHref="/assets" />

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : !asset ? (
        <div className={`${ui.card} p-4 text-sm text-[#434655]`}>Asset not found.</div>
      ) : (
        <>
          <section className={`${ui.card} relative overflow-hidden p-3`}>
            <div className="flex h-44 items-center justify-center rounded-xl bg-[#eff4ff] text-[#434655]">
              Device photo
            </div>
            <span className="absolute right-5 top-5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
              {asset.status}
            </span>
          </section>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#004ac6]">
              {asset.asset_type}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0b1c30]">{asset.asset_name}</h2>
          </div>

          <div className={`${ui.card} space-y-3 p-4 text-sm`}>
            <div className="flex justify-between gap-2">
              <span className="text-[#434655]">Asset code</span>
              <span className="font-semibold text-[#0b1c30]">{asset.asset_code}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#434655]">Serial</span>
              <span className="font-semibold text-[#0b1c30]">{asset.serial_number || "—"}</span>
            </div>
            {asset.qr_code ? (
              <div className="flex justify-between gap-2">
                <span className="text-[#434655]">QR</span>
                <span className="font-semibold text-[#0b1c30]">{asset.qr_code}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <span className="text-[#434655]">Assignment</span>
              <span className="font-semibold text-[#0b1c30]">
                {asset.assignment_status || "—"}
              </span>
            </div>
          </div>

          <Link href={`/assets/${asset.id}/report`} className={`${ui.btn} block text-center`}>
            Report issue
          </Link>
        </>
      )}
    </div>
  );
}
