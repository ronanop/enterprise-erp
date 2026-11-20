"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/app-header";
import { EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssPolicyItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function ComplianceHubPage() {
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

  const { pending, acknowledged } = useMemo(() => {
    const pend = items.filter((p) => !p.acknowledged);
    const acked = items.filter((p) => p.acknowledged);
    return { pending: pend, acknowledged: acked };
  }, [items]);

  return (
    <div className="space-y-5">
      <SubHeader title="Policy walkthrough" backHref="/home" />

      <div className={`${ui.card} space-y-2 p-4`}>
        <p className="text-sm font-semibold text-[#0b1c30]">Company policies</p>
        <p className="text-sm text-[#434655]">
          {pending.length > 0
            ? "Read and acknowledge required policies to continue using the app."
            : "Browse published policies anytime from Quick Actions."}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading policies…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="HR has not published any ESS policies for your company."
        />
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className={ui.sectionTitle}>Action required</h2>
              <ul className="space-y-3">
                {pending.map((p, index) => (
                  <PolicyRow key={p.id} policy={p} index={index + 1} pending />
                ))}
              </ul>
            </section>
          ) : (
            <div className={`${ui.card} px-4 py-3 text-sm font-medium text-emerald-800`}>
              You are up to date — all required policies are acknowledged.
            </div>
          )}

          {acknowledged.length > 0 ? (
            <section className="space-y-3">
              <h2 className={ui.sectionTitle}>Acknowledged</h2>
              <ul className="space-y-3">
                {acknowledged.map((p, index) => (
                  <PolicyRow
                    key={p.id}
                    policy={p}
                    index={index + 1}
                    pending={false}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function PolicyRow({
  policy,
  index,
  pending,
}: {
  policy: EssPolicyItem;
  index: number;
  pending: boolean;
}) {
  return (
    <li>
      <Link
        href={`/compliance/${policy.id}`}
        className={`${ui.card} flex items-center gap-3 p-4 transition active:scale-[0.99]`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            pending
              ? "bg-[#dbe1ff] text-[#004ac6]"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#0b1c30]">{policy.title}</p>
          <p className="text-xs text-[#434655]">
            {policy.policy_code} · v{policy.policy_version} · {policy.step_count}{" "}
            step{policy.step_count === 1 ? "" : "s"}
            {pending ? "" : " · Done"}
          </p>
        </span>
        <span className="text-sm font-semibold text-[#2563eb]">
          {pending ? "Open" : "View"}
        </span>
      </Link>
    </li>
  );
}
