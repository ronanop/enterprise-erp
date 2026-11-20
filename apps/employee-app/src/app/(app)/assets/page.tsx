"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconAlert,
  IconBack,
  IconBolt,
  IconGrid,
  IconHeadset,
  IconHistory,
  IconInfo,
  IconLaptop,
  IconLayers,
  IconMobile,
  IconSearch,
} from "@/components/icons";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import { NotificationBellLink } from "@/components/notification-bell-link";
import { Avatar } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { essService } from "@/services/ess-service";
import type { EssAsset } from "@/types/api";

type CategoryId =
  | "all"
  | "laptop"
  | "mobile"
  | "accessories"
  | "other"
  | "fixed"
  | "consumable"
  | "digital"
  | "leased";

const CATEGORIES: {
  id: CategoryId;
  label: string;
  Icon: typeof IconGrid;
  match?: (a: EssAsset) => boolean;
}[] = [
  { id: "all", label: "All Assets", Icon: IconGrid },
  {
    id: "laptop",
    label: "Laptop",
    Icon: IconLaptop,
    match: (a) => /laptop|notebook|macbook|computer/i.test(`${a.asset_type} ${a.asset_name}`),
  },
  {
    id: "mobile",
    label: "Mobile",
    Icon: IconMobile,
    match: (a) => /mobile|phone|tablet|ipad/i.test(`${a.asset_type} ${a.asset_name}`),
  },
  {
    id: "accessories",
    label: "Accessories",
    Icon: IconHeadset,
    match: (a) =>
      /accessor|headphone|mouse|keyboard|monitor|dock|charger|cable/i.test(
        `${a.asset_type} ${a.asset_name}`,
      ),
  },
  {
    id: "other",
    label: "Other",
    Icon: IconLayers,
    match: () => true,
  },
];

const QUICK_ACTIONS = [
  {
    href: "/assets",
    label: "View Assets",
    Icon: IconLaptop,
    bg: "bg-[#E7F1FF]",
    fg: "text-[#3B7CFF]",
  },
  {
    href: "/support/new",
    label: "Report Issue",
    Icon: IconAlert,
    bg: "bg-[#FFF0E4]",
    fg: "text-[#F08A3A]",
  },
  {
    href: "/assets",
    label: "Asset History",
    Icon: IconHistory,
    bg: "bg-[#E7F1FF]",
    fg: "text-[#3B7CFF]",
  },
  {
    href: "/compliance",
    label: "Asset Policy",
    Icon: IconInfo,
    bg: "bg-[#EEE8FF]",
    fg: "text-[#7B61FF]",
  },
] as const;

export default function AssetsPage() {
  const { me } = useEssMe();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
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
    const selected = CATEGORIES.find((c) => c.id === category);

    return assets.filter((a) => {
      if (category !== "all" && selected?.match) {
        if (category === "other") {
          const covered = CATEGORIES.some(
            (c) => c.id !== "all" && c.id !== "other" && c.match?.(a),
          );
          if (covered) return false;
        } else if (!selected.match(a)) {
          return false;
        }
      }
      if (
        q &&
        !`${a.asset_name} ${a.asset_code} ${a.serial_number ?? ""} ${a.asset_type}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [assets, query, category]);

  return (
    <div className="relative -mx-5 min-h-full bg-[#F3F5FB] pb-8 text-[#152238]">
      <div className="px-5 pt-3">
        {/* Brand header */}
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/home"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#1A2B56] transition active:scale-95"
              aria-label="Back"
            >
              <IconBack size={20} />
            </Link>
            <CacheBrandLogo height={38} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBellLink className="!h-10 !w-10 !rounded-full !bg-white !text-[#1A2B56] !shadow-sm" />
            <Link href="/profile" className="shrink-0" aria-label="Profile">
              <Avatar
                name={me?.display_name ?? ""}
                size="sm"
                ring
                photoUrl={me?.photo_url}
              />
            </Link>
          </div>
        </header>

        {/* Hero banner */}
        <section className="relative mb-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-[#EDE7FF] via-[#F0EBFF] to-[#E4EEFF] px-4 py-4 shadow-[0_10px_24px_rgba(123,97,255,0.12)]">
          <div className="pointer-events-none absolute -left-6 -top-8 h-28 w-28 rounded-full bg-[#D9CFFF]/60 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 right-16 h-28 w-28 rounded-full bg-[#C7D9FF]/55 blur-2xl" />
          <div className="relative z-[1] flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[1.45rem] font-bold tracking-tight text-[#1A2B56]">
                My Assets
              </h1>
              <p className="mt-1 text-sm leading-snug text-[#5B6475]">
                View and manage your company assets.
              </p>
            </div>
            <div className="relative h-[88px] w-[96px] shrink-0">
              <Image
                src="/assets-ui/banner-laptop.jpg"
                alt=""
                fill
                className="object-contain object-right"
                sizes="96px"
                priority
              />
            </div>
          </div>
        </section>

        {/* Search */}
        <div className="mb-3">
          <label className="flex min-w-0 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3.5 py-3 shadow-sm">
            <IconSearch size={18} className="shrink-0 text-[#9CA3AF]" />
            <input
              className="w-full bg-transparent text-sm text-[#152238] outline-none placeholder:text-[#9CA3AF]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets (e.g. Laptop, Monitor...)"
            />
          </label>
        </div>

        {/* Category chips */}
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[#1A2B56] text-white shadow-sm"
                    : "bg-[#EEF2FF] text-[#4B5563]"
                }`}
              >
                <c.Icon size={15} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* List / empty */}
        {loading ? (
          <div className="mb-5 rounded-[22px] border border-[#E8ECF5] bg-white px-4 py-10 text-center text-sm text-[#6B7280] shadow-sm">
            Loading assets…
          </div>
        ) : rows.length === 0 ? (
          <section className="mb-5 rounded-[22px] border border-[#E8ECF5] bg-white px-5 py-8 text-center shadow-[0_10px_28px_rgba(26,43,86,0.06)]">
            <div className="relative mx-auto mb-4 h-36 w-36">
              <Image
                src="/assets-ui/empty-box.jpg"
                alt=""
                fill
                className="object-contain"
                sizes="144px"
              />
            </div>
            <h2 className="text-lg font-bold text-[#1A2B56]">No assets assigned</h2>
            <p className="mx-auto mt-1.5 max-w-[260px] text-sm leading-relaxed text-[#6B7280]">
              You currently have no company assets assigned to your account.
            </p>
          </section>
        ) : (
          <ul className="mb-5 space-y-3">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assets/${a.id}`}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E8ECF5] bg-white p-4 shadow-[0_6px_16px_rgba(26,43,86,0.05)] transition active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEE8FF] text-[#7B61FF]">
                      <IconLaptop size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#152238]">
                        {a.asset_name}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">
                        {a.asset_code}
                        {a.serial_number ? ` · ${a.serial_number}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3B7CFF]">
                    {a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Quick Actions */}
        <section className="mb-4">
          <div className="mb-3">
            <h2 className="flex items-center gap-1.5 text-[1.05rem] font-bold text-[#152238]">
              <IconBolt size={18} className="text-[#7B61FF]" />
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2.5 rounded-[16px] border border-[#E8ECF5] bg-white px-3 py-3.5 shadow-[0_6px_14px_rgba(26,43,86,0.04)] transition active:scale-[0.98]"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg} ${item.fg}`}
                >
                  <item.Icon size={18} />
                </span>
                <span className="text-sm font-semibold text-[#374151]">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
