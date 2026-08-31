"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { EmptyState } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { essService } from "@/services/ess-service";
import type { EssPolicyItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function ComplianceHubPage() {
  const router = useRouter();
  const { refresh } = useEssMe();
  const [items, setItems] = useState<EssPolicyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    essService
      .policies()
      .then((res) => {
        if (!cancelled) setItems(res.data ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = items.filter((p) => !p.acknowledged);

  useEffect(() => {
    if (!loading && pending.length === 0) {
      void refresh().then(() => router.replace("/home"));
    }
  }, [loading, pending.length, refresh, router]);

  return (
    <div className="space-y-5">
      <SubHeader title="Policy walkthrough" backHref="/home" />

      <p className="text-sm text-[#434655]">
        Read and acknowledge each policy to unlock the rest of the app. Content is split into
        short steps.
      </p>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading policies…</p>
      ) : pending.length === 0 ? (
        <EmptyState title="All set" description="Redirecting to home…" />
      ) : (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li key={p.id}>
              <Link href={`/compliance/${p.id}`} className={`${ui.card} block p-4`}>
                <p className="font-semibold text-[#0b1c30]">{p.title}</p>
                <p className="text-xs text-[#434655]">
                  v{p.policy_version} · {p.step_count} step{p.step_count === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
