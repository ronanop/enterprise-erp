"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

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
        if (job.can_open_form !== false) {
          router.push(job.form_path);
          return;
        }
        onBlocked?.(
          "You are not assigned to this step yet. Ask the project admin to assign you from Project Tracking.",
        );
      }}
    >
      {completed ? "View step" : "Open step"}
      <ChevronRight className="size-3.5" aria-hidden />
    </button>
  );
}
