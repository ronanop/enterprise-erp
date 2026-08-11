"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  isAssignedStepActive,
  workflowStageNotCompleteMessage,
} from "@/lib/projects/site-stage-form-access";
import type { ProjectMyJob } from "@/services/projects-portal-service";

export function MyJobOpenStepButton({
  job,
  onBlocked,
  completed = false,
}: {
  job: ProjectMyJob;
  onBlocked?: (message: string) => void;
  completed?: boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      onClick={() => {
        if (completed) {
          router.push(job.form_path);
          return;
        }
        if (!isAssignedStepActive(job.assigned_stage, job.workflow_stage)) {
          onBlocked?.(workflowStageNotCompleteMessage(job.workflow_stage));
          return;
        }
        router.push(job.form_path);
      }}
    >
      {completed ? "View step" : "Open step"}
      <ChevronRight className="size-3.5" aria-hidden />
    </button>
  );
}
