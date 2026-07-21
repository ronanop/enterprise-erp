"use client";

import { Construction } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

/** Placeholder for teamspace tabs not yet built out (Calls, KYC, Reports, Analytics). */
export function StubPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description ?? "This area is coming soon."} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card px-6 py-16 text-center shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title} is coming soon</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            This module is on the roadmap and isn&rsquo;t wired to a backend API yet in this demo build.
          </p>
        </div>
      </div>
    </div>
  );
}
