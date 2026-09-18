"use client";

import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Calendar,
  FileText,
  Search,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

import { GlobalNotificationBell } from "@/components/layout/global-notification-bell";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { Input } from "@/components/ui/input";
import {
  formatHeaderDate,
  type SearchHit,
} from "@/components/hr/recruitment/dashboard/dashboard-model";
import { QuickActionCard } from "@/components/hr/recruitment/dashboard/quick-action-card";
import { useAuthUser } from "@/hooks/use-auth-user";
import { signOutAndRedirect } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

export function DashboardChrome({
  query,
  onQueryChange,
  hits,
  onHit,
  onCreateJob,
  onAddCandidate,
  onScheduleInterview,
  onGenerateOffer,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  hits: SearchHit[];
  onHit: (hit: SearchHit) => void;
  onCreateJob: () => void;
  onAddCandidate: () => void;
  onScheduleInterview: () => void;
  onGenerateOffer: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [openHits, setOpenHits] = useState(false);
  const [asOf, setAsOf] = useState(() => new Date());
  const { signedIn, loading: authLoading } = useAuthUser();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setOpenHits(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9CA3AF]" strokeWidth={1.75} />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpenHits(true);
            }}
            onFocus={() => setOpenHits(true)}
            onBlur={() => window.setTimeout(() => setOpenHits(false), 160)}
            placeholder="Search candidates, jobs, or anything..."
            className="h-10 rounded-full border-[#EEEFF3] bg-white pr-20 pl-10 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-[#EEEFF3] bg-[#F8F8FC] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3AF]">
            Ctrl + K
          </kbd>
          {openHits && query.trim() && hits.length > 0 ? (
            <ul className="absolute top-[calc(100%+6px)] z-40 w-full overflow-hidden rounded-[12px] border border-[#EEEFF3] bg-white py-1 shadow-lg">
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-[#FAFAFC]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onHit(hit)}
                  >
                    <HitIcon kind={hit.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[#111827]">{hit.title}</span>
                      <span className="block truncate text-[11px] text-[#9CA3AF]">{hit.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <GlobalNotificationBell variant="topbar" className="text-[#6B7280]" />
          {signedIn || authLoading ? (
            <UserAccountMenu variant="compact" onSignOut={signOutAndRedirect} />
          ) : null}
          <label className="relative ml-1 flex cursor-pointer items-center gap-2 rounded-full border border-[#EEEFF3] bg-white px-3 py-1.5 text-[12px] text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Calendar className="size-3.5 text-[#7C3AED]" strokeWidth={1.75} />
            <span>{formatHeaderDate(asOf)}</span>
            <input
              type="date"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={isoDate(asOf)}
              onChange={(e) => {
                if (!e.target.value) return;
                setAsOf(new Date(`${e.target.value}T00:00:00`));
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-[#111827]">Recruitment</h1>
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 xl:max-w-[640px] xl:grid-cols-4">
          <QuickActionCard
            label="Create Job Opening"
            icon={Briefcase}
            tone="lavender"
            compact
            onClick={onCreateJob}
          />
          <QuickActionCard
            label="Add Candidate"
            icon={UserPlus}
            tone="mint"
            compact
            onClick={onAddCandidate}
          />
          <QuickActionCard
            label="Schedule Interview"
            icon={Calendar}
            tone="peach"
            compact
            onClick={onScheduleInterview}
          />
          <QuickActionCard
            label="Generate Offer"
            icon={FileText}
            tone="pink"
            compact
            onClick={onGenerateOffer}
          />
        </div>
      </div>
    </div>
  );
}

function HitIcon({ kind }: { kind: SearchHit["kind"] }) {
  switch (kind) {
    case "job":
      return <Briefcase className="size-3.5 text-[#7C3AED]" strokeWidth={1.75} />;
    case "candidate":
      return <Users className="size-3.5 text-[#7C3AED]" strokeWidth={1.75} />;
    case "interview":
      return <Video className="size-3.5 text-[#FF8904]" strokeWidth={1.75} />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ViewAllLink({
  onClick,
  label = "View All",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer text-[12px] font-medium text-[#7C3AED] transition-opacity duration-150 hover:opacity-80",
      )}
    >
      {label}
    </button>
  );
}
