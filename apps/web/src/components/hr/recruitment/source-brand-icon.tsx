"use client";

import { Globe, UserRound, Users } from "lucide-react";

import type { CandidateSource } from "@/types/recruitment-ats";
import { SOURCE_LABELS } from "@/types/recruitment-ats";

export function SourceBrandIcon({ source }: { source: string }) {
  switch (source) {
    case "linkedin":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[10px] font-bold leading-none text-white"
          aria-hidden
        >
          in
        </span>
      );
    case "naukri":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#2557A7] text-[10px] font-bold leading-none text-white"
          aria-hidden
        >
          N
        </span>
      );
    case "indeed":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#2557A7] text-[11px] font-bold leading-none text-white"
          aria-hidden
        >
          i
        </span>
      );
    case "referral":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] bg-[#FF8904] text-white"
          aria-hidden
        >
          <Users className="size-3" strokeWidth={2.5} />
        </span>
      );
    case "company_website":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#00A866] text-white"
          aria-hidden
        >
          <Globe className="size-3" strokeWidth={2.5} />
        </span>
      );
    case "campus":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#9B5BB8] text-[9px] font-bold leading-none text-white"
          aria-hidden
        >
          C
        </span>
      );
    case "walk_in":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#F43F5E] text-[9px] font-bold leading-none text-white"
          aria-hidden
        >
          W
        </span>
      );
    case "recruiter":
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#155DFD] text-white"
          aria-hidden
        >
          <UserRound className="size-3" strokeWidth={2.5} />
        </span>
      );
    default:
      return (
        <span
          className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#9CA3AF] text-[9px] font-bold leading-none text-white"
          aria-hidden
        >
          ?
        </span>
      );
  }
}

export function SourceCell({ source }: { source: CandidateSource | string }) {
  const key = String(source);
  const label = SOURCE_LABELS[key as CandidateSource] ?? key;
  return (
    <span className="inline-flex items-center gap-1.5">
      <SourceBrandIcon source={key} />
      <span className="text-[11px] text-[#374151]">{label}</span>
    </span>
  );
}
