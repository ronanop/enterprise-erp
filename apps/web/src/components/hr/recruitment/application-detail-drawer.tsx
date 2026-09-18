"use client";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES, STATUS_LABELS } from "@/config/pipeline-config";
import type {
  AtsCandidate,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  application: PipelineApplication | null;
  candidate: AtsCandidate | null;
  job: JobOpening | null;
};

export function ApplicationDetailDrawer({
  open,
  onClose,
  application,
  candidate,
  job,
}: Props) {
  if (!application) return null;

  const stageLabel =
    PIPELINE_STAGES.find((s) => s.id === application.stage)?.label ?? application.stage;
  const exitedLabel = application.exitedAtStage
    ? PIPELINE_STAGES.find((s) => s.id === application.exitedAtStage)?.label ??
      application.exitedAtStage
    : null;
  const history =
    application.stageHistory?.length
      ? application.stageHistory
      : [
          {
            stage: application.stage,
            label: stageLabel,
            enteredAt: application.stageEnteredAt || application.appliedAt,
          },
        ];

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title={candidate?.fullName ?? "Application"}
      description={`${application.applicationCode} · ${job?.title ?? "Role"}`}
      footer={
        <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Current stage
            </p>
            <p className="mt-1 font-medium">{stageLabel}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <div className="mt-1">
              <HrStatusBadge status={STATUS_LABELS[application.status]} />
            </div>
          </div>
        </div>

        {application.status !== "active" && (exitedLabel || application.exitReason) ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Exit details
            </p>
            {exitedLabel ? (
              <p className="mt-1 text-xs">
                Exited at stage: <span className="font-medium">{exitedLabel}</span>
              </p>
            ) : null}
            {application.exitedAt ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {String(application.exitedAt).slice(0, 10)}
              </p>
            ) : null}
            {application.exitReason ? (
              <p className="mt-2 text-xs text-foreground">{application.exitReason}</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Stage history
          </p>
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li
                key={`${h.stage}-${h.enteredAt}-${i}`}
                className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs"
              >
                <p className="font-medium text-foreground">{h.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Entered {String(h.enteredAt).slice(0, 10)}
                  {h.exitedAt ? ` · Exited ${String(h.exitedAt).slice(0, 10)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SetupDrawer>
  );
}
