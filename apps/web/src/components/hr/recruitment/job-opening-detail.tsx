"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, UserPlus, XCircle } from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import {
  APPLIED_STAGE_ID,
  PIPELINE_STAGES,
  STATUS_LABELS,
} from "@/config/pipeline-config";
import type {
  AtsCandidate,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { SOURCE_LABELS } from "@/types/recruitment-ats";

export function JobOpeningDetail({
  job,
  applications,
  candidates,
  onBack,
  onEdit,
  onAddCandidate,
  onAccept,
  onReject,
  onViewCandidate,
  onPreviewResume,
}: {
  job: JobOpening;
  applications: PipelineApplication[];
  candidates: AtsCandidate[];
  onBack: () => void;
  onEdit: () => void;
  onAddCandidate: () => void;
  onAccept: (applicationId: string) => void;
  onReject: (applicationId: string, reason: string) => void;
  onViewCandidate: (candidate: AtsCandidate) => void;
  onPreviewResume: (candidate: AtsCandidate) => void;
}) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const candById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const jobApps = useMemo(
    () =>
      applications
        .filter((a) => a.jobId === job.id && a.status === "active")
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    [applications, job.id],
  );

  const awaitingApps = useMemo(
    () => jobApps.filter((a) => a.stage === APPLIED_STAGE_ID),
    [jobApps],
  );

  const pipelineApps = useMemo(
    () => jobApps.filter((a) => a.stage !== APPLIED_STAGE_ID),
    [jobApps],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to job openings
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{job.title}</h2>
          <p className="text-xs text-muted-foreground">
            {job.jobCode} · {job.department || "—"} · {job.location || "—"} ·{" "}
            <span className="uppercase">{job.status}</span>
            {" · "}
            <span
              className={
                job.postingAudience === "internal"
                  ? "font-semibold text-amber-800"
                  : "font-semibold text-emerald-800"
              }
            >
              {job.postingAudience === "internal" ? "Internal" : "External"}
            </span>
            {job.evidenceEmailFileName ? (
              <>
                {" · "}
                Evidence: {job.evidenceEmailFileName}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={onAddCandidate}
          >
            <UserPlus className="size-3.5" />
            Add Candidate
          </Button>
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onEdit}>
            Edit job
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Positions", `${job.filled}/${job.positions}`],
          ["Audience", job.postingAudience === "internal" ? "Internal" : "External"],
          ["Priority", job.priority],
          ["Experience", `${job.experienceMin}–${job.experienceMax} yrs`],
          ["Applied (awaiting)", String(awaitingApps.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {job.description ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{job.description}</p>
        </div>
      ) : null}

      <section className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Applied candidates</h3>
          <p className="text-[11px] text-muted-foreground">
            Careers-site applications — accept to move into Screening
          </p>
        </div>
        {!awaitingApps.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No pending careers applications. Share the careers link for applicants to apply.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {awaitingApps.map((app) => {
              const cand = candById.get(app.candidateId);
              if (!cand) return null;
              return (
                <li key={app.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => onViewCandidate(cand)}
                  >
                    <InitialsAvatar name={cand.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cand.fullName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {cand.email} · {cand.phone || "—"}
                        {cand.resumeName ? ` · Resume: ${cand.resumeName}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        Source: {SOURCE_LABELS[cand.source] ?? cand.source}
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer text-[11px]"
                    disabled={!cand.resumeName && !cand.resumeUrl}
                    onClick={() => onPreviewResume(cand)}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 cursor-pointer text-[11px]"
                    onClick={() => onAccept(app.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer text-[11px] text-destructive"
                    onClick={() => {
                      setRejectId(app.id);
                      setRejectReason("");
                    }}
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Candidates on this job</h3>
            <p className="text-[11px] text-muted-foreground">
              Added via HRMS or already moved into the pipeline
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 cursor-pointer text-[11px]"
            onClick={onAddCandidate}
          >
            <UserPlus className="size-3.5" />
            Add Candidate
          </Button>
        </div>
        {!pipelineApps.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No HRMS / pipeline candidates on this job yet. Use Add Candidate to create one.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {pipelineApps.map((app) => {
              const cand = candById.get(app.candidateId);
              if (!cand) return null;
              const stageLabel =
                PIPELINE_STAGES.find((s) => s.id === app.stage)?.label ?? app.stage;
              return (
                <li key={app.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => onViewCandidate(cand)}
                  >
                    <InitialsAvatar name={cand.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cand.fullName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {cand.email} · {cand.phone || "—"}
                        {cand.resumeName ? ` · Resume: ${cand.resumeName}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        Source: {SOURCE_LABELS[cand.source] ?? cand.source} ·{" "}
                        {STATUS_LABELS[app.status] ?? app.status}
                      </p>
                    </div>
                  </button>
                  <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                    {stageLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg">
            <h4 className="text-sm font-semibold">Reject applicant</h4>
            <textarea
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason required"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setRejectId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  onReject(rejectId, rejectReason.trim());
                  setRejectId(null);
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
