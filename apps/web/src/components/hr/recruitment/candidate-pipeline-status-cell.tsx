"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/config/pipeline-config";
import type {
  CandidatePipelineStatus,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";

type Props = {
  application: PipelineApplication | null;
  onChangeStage: (applicationId: string, stage: PipelineStage) => void;
};

type MenuPos = { top: number; left: number; width: number; openUp: boolean };

type StatusTone = { label: string; tone: string };

function resolveStatusTone(application: PipelineApplication): StatusTone {
  const outcome = application.status as CandidatePipelineStatus;
  if (outcome === "hired") {
    return { label: "Hired", tone: "bg-[#ECFDF5] text-[#00A866]" };
  }
  if (outcome === "rejected") {
    return { label: "Rejected", tone: "bg-[#FFF1F2] text-[#F43F5E]" };
  }
  if (outcome === "offer_declined") {
    return { label: "Offer Declined", tone: "bg-[#FFF1F2] text-[#F43F5E]" };
  }
  if (outcome === "backed_out") {
    return { label: "Backed Out", tone: "bg-[#FFF1F2] text-[#BE123C]" };
  }

  switch (application.stage) {
    case "sourced":
      return { label: "Applied", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    case "screening":
      return { label: "Screening", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    case "interview_round_1":
    case "interview_round_2":
    case "hr_discussion":
      return { label: "Interview", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    case "background_check":
      return { label: "On Hold", tone: "bg-[#FFF4E5] text-[#FF8904]" };
    case "offer_sent":
      return { label: "Offer Sent", tone: "bg-[#FCE7F3] text-[#DB2777]" };
    case "offer_accepted":
      return { label: "Offer Accepted", tone: "bg-[#ECFDF5] text-[#00A866]" };
    default: {
      const _exhaustive: never = application.stage;
      return _exhaustive;
    }
  }
}

export function CandidatePipelineStatusCell({ application, onChangeStage }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 208),
      openUp,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  if (!application) {
    return (
      <span className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-semibold text-[#6B7280]">
        Not applied
      </span>
    );
  }

  const display = resolveStatusTone(application);
  const canChange = application.status === "active";

  const menu =
    mounted && open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[200] max-h-72 overflow-y-auto rounded-lg border border-border/70 bg-card py-1 shadow-md"
            style={{
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: Math.min(pos.left, window.innerWidth - pos.width - 8),
              width: pos.width,
            }}
          >
            <p className="px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Pipeline stage
            </p>
            {PIPELINE_STAGES.map((s) => {
              const active = s.id === application.stage;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={!canChange}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                    active && "bg-[#F5F3FF] font-medium text-[#7C3AED]",
                  )}
                  onClick={() => {
                    if (s.id !== application.stage && canChange) {
                      onChangeStage(application.id, s.id);
                    }
                    setOpen(false);
                  }}
                >
                  <span>{s.label}</span>
                  {active ? (
                    <span className="text-[10px] text-muted-foreground">Current</span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="min-w-0 max-w-full">
      <button
        ref={buttonRef}
        type="button"
        disabled={!canChange}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-opacity",
          display.tone,
          canChange ? "cursor-pointer hover:opacity-90" : "cursor-default",
        )}
        onClick={() => {
          if (canChange) setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{display.label}</span>
        {canChange ? (
          <ChevronDown
            className={cn("size-3 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
          />
        ) : null}
      </button>
      {menu}
    </div>
  );
}
