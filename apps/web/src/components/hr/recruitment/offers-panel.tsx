"use client";

import { useMemo, useState } from "react";
import { Building2, FileCheck2, Plus } from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import type {
  AtsCandidate,
  AtsOffer,
  JobOpening,
  OfferStatus,
} from "@/types/recruitment-ats";
import { OFFER_STATUS_LABELS } from "@/types/recruitment-ats";

const PAGE = 10;

/** Same fill as the Offers tab pill. `!` beats Button's `bg-primary`. */
const STRIP_CTA =
  "!bg-[#7C3AED] !text-white hover:!bg-[#6D28D9] hover:!text-white";

type Props = {
  offers: AtsOffer[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  onGenerate: () => void;
  onSend: (offerId: string) => void;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onOnboard: (offer: AtsOffer) => void;
  onboardingOfferId?: string | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function statusTone(status: OfferStatus): string {
  switch (status) {
    case "draft":
      return "bg-[#F3F4F6] text-[#6B7280]";
    case "sent":
      return "bg-[#F5F3FF] text-[#7C3AED]";
    case "accepted":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "rejected":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "expired":
      return "bg-[#FFF7ED] text-[#C2410C]";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

export function OffersPanel({
  offers,
  candidates,
  jobs,
  onGenerate,
  onSend,
  onAccept,
  onDecline,
  onOnboard,
  onboardingOfferId = null,
}: Props) {
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(1);

  const candMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const departments = useMemo(() => {
    const set = new Set(offers.map((o) => o.department).filter(Boolean));
    return [
      { value: "all", label: "All Departments" },
      ...[...set].sort().map((d) => ({ value: d, label: d })),
    ];
  }, [offers]);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (department !== "all" && o.department !== department) return false;
      return true;
    });
  }, [offers, status, department]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            className="w-[140px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
          />
          <div className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <FilterSelect
              value={department}
              onChange={(v) => {
                setDepartment(v);
                setPage(1);
              }}
              options={departments}
              className="w-[170px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:pl-8 [&_button]:text-[12px]"
            />
          </div>
        </div>
        <Button
          size="sm"
          className={cn("h-9 cursor-pointer rounded-full", STRIP_CTA)}
          style={{ backgroundColor: "#7C3AED", color: "#fff" }}
          onClick={onGenerate}
        >
          <Plus className="size-3.5" />
          Generate Offer
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
              <FileCheck2 className="size-5" />
            </div>
            <p className="text-sm font-medium text-[#374151]">No offers yet</p>
            <p className="text-[12px] text-[#9CA3AF]">
              Generate an offer letter for a candidate who has cleared interviews
            </p>
            <Button
              size="sm"
              className={cn("mt-1 cursor-pointer rounded-full", STRIP_CTA)}
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
              onClick={onGenerate}
            >
              Generate Offer
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Offer ID</th>
                    <th className="px-3 py-2.5 font-medium">Candidate</th>
                    <th className="px-3 py-2.5 font-medium">Position</th>
                    <th className="px-3 py-2.5 font-medium">CTC</th>
                    <th className="px-3 py-2.5 font-medium">Join</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o, i) => {
                    const cand = candMap.get(o.candidateId);
                    const job = jobMap.get(o.jobId);
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFBFC]"
                      >
                        <td className="px-3 py-2.5 font-medium text-primary">
                          <span style={{ color: "#9B5BB8" }}>{o.offerCode}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <InitialsAvatar
                              name={cand?.fullName ?? "?"}
                              toneIndex={i}
                              size="sm"
                            />
                            <span className="text-[12px] font-medium text-[#111827]">
                              {cand?.fullName ?? "—"}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#374151]">
                          {job?.title ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#111827]">
                          {o.ctc ? `₹${o.ctc.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#6B7280]">
                          {o.joiningDate || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              statusTone(o.status),
                            )}
                          >
                            {OFFER_STATUS_LABELS[o.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {o.status === "draft" ? (
                              <Button
                                type="button"
                                size="sm"
                                className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                                onClick={() => onSend(o.id)}
                              >
                                Send
                              </Button>
                            ) : null}
                            {o.status === "sent" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                                  onClick={() => onAccept(o.id)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 cursor-pointer"
                                  onClick={() => onDecline(o.id)}
                                >
                                  Decline
                                </Button>
                              </>
                            ) : null}
                            {o.status === "accepted" ? (
                              <Button
                                type="button"
                                size="sm"
                                className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                                disabled={onboardingOfferId === o.id}
                                onClick={() => onOnboard(o)}
                              >
                                {onboardingOfferId === o.id ? "Starting…" : "Onboard"}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2">
              <EmsPagination
                page={page}
                pageSize={PAGE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
