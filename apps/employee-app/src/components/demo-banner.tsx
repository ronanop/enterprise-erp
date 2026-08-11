"use client";

import { env } from "@/utils/env";

export function DemoBanner() {
  if (!env.useMock) return null;

  return (
    <div className="bg-[#712ae2] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white">
      Demo data · Riya Sharma · punch started 10:00 AM
    </div>
  );
}
