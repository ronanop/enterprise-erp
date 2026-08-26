"use client";

import { useMemo, useState } from "react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { cn } from "@/lib/utils";
import type {
  AtsCandidate,
  JobOpening,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";
import { PIPELINE_STAGES } from "@/types/recruitment-ats";

type Props = {
  applications: PipelineApplication[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  onMove: (applicationId: string, stage: PipelineStage) => void;
};

export function PipelineKanban({ applications, candidates, jobs, onMove }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);

  const candMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, PipelineApplication[]>();
    for (const s of PIPELINE_STAGES) map.set(s.id, []);
    for (const a of applications) {
      const list = map.get(a.stage) ?? map.get("applied")!;
      list.push(a);
    }
    return map;
  }, [applications]);

  return (
    <div className="erp-scroll flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage) => {
        const cards = byStage.get(stage.id) ?? [];
        return (
          <div
            key={stage.id}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors duration-200",
              overStage === stage.id ? "border-primary bg-primary/5" : "border-border/70",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/application-id") || draggingId;
              if (id) onMove(id, stage.id);
              setDraggingId(null);
              setOverStage(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
                {stage.label}
              </p>
              <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto p-2">
              {cards.map((app) => {
                const cand = candMap.get(app.candidateId);
                const job = jobMap.get(app.jobId);
                return (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(app.id);
                      e.dataTransfer.setData("text/application-id", app.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    className={cn(
                      "cursor-grab rounded-lg border border-border/70 bg-card p-2.5 shadow-sm transition-shadow duration-200 hover:shadow-md active:cursor-grabbing",
                      draggingId === app.id && "opacity-60",
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">
                      {cand?.fullName ?? "Candidate"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {job?.title ?? "Role"} · {app.applicationCode}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <HrStatusBadge status={stage.label} />
                      <span className="text-[10px] text-muted-foreground">{app.appliedAt}</span>
                    </div>
                  </div>
                );
              })}
              {cards.length === 0 ? (
                <p className="px-1 py-6 text-center text-[10px] text-muted-foreground">
                  Drop cards here
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
