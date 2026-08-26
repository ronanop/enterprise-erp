"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoiceAgentLeadPreview } from "@/modules/voice-agent/voice-agent-provider";
import { leadDisplayName } from "@/services/voice-agent-service";

export function VoiceAgentLeadPreview() {
  const { leadPreview, clearLeadPreview } = useVoiceAgentLeadPreview();

  if (!leadPreview) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        When the agent calls <code className="text-xs">showLead</code>, lead details appear here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Agent opened lead
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {leadDisplayName(leadPreview)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {leadPreview.company_name ?? leadPreview.entity_name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{leadPreview.lead_code}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="cursor-pointer shrink-0"
          onClick={clearLeadPreview}
          aria-label="Dismiss lead preview"
        >
          <X className="size-4" />
        </Button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{leadPreview.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{leadPreview.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mobile</dt>
          <dd className="font-medium">{leadPreview.mobile ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
