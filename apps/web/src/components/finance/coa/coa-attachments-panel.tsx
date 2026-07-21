"use client";

import { Paperclip } from "lucide-react";

type Props = {
  accountId: string;
  readOnly?: boolean;
};

/** Attachments panel — API-ready shell until Finance↔DMS link for COA exists. */
export function CoaAttachmentsPanel({ accountId, readOnly }: Props) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <Paperclip className="size-3.5" /> Attachments
      </h3>
      <p className="mt-2 text-xs text-muted-foreground">
        Document attachments for account <span className="font-mono">{accountId.slice(0, 8)}</span>{" "}
        will use the Document module when the COA attachment API is enabled.
        {readOnly ? " Upload is disabled in read-only mode." : ""}
      </p>
      <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
        No attachments · API-ready
      </div>
    </div>
  );
}
