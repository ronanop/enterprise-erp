"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ApiClientError,
  businessOwnerReviewContent,
  type MarketingContentItem,
} from "@/services/marketing-service";

type Props = {
  item: MarketingContentItem;
  onDone: (updated: MarketingContentItem) => void;
};

export function MarketingBusinessOwnerReviewPanel({ item, onDone }: Props) {
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const awaiting =
    item.workflow_stage === "business_owner_review" &&
    (item.business_owner_review?.status === "awaiting_business_owner" ||
      !item.business_owner_review?.status);

  if (!awaiting) {
    const bo = item.business_owner_review;
    if (!bo?.status || bo.status === "awaiting_business_owner") return null;
    return (
      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Business owner: <span className="font-medium text-foreground">{bo.status}</span>
        {bo.comments ? ` — ${bo.comments}` : null}
      </div>
    );
  }

  async function decide(status: "approved" | "changes_requested" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const updated = await businessOwnerReviewContent(item.id, {
        status,
        comments: comments.trim() || undefined,
      });
      onDone(updated);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
      <div>
        <h3 className="text-sm font-medium tracking-tight">Business owner review</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Marketing head approved this draft. Approve to send it to the LinkedIn handler for the
          final draft, reject it, or send feedback to marketing head.
        </p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <p className="font-medium text-foreground">{item.title}</p>
        <p className="mt-1 text-muted-foreground line-clamp-3">{item.body || "No body"}</p>
        {item.summary ? <p className="mt-1 text-muted-foreground">Company: {item.summary}</p> : null}
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Feedback / comments (required for reject or send back)
        </span>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
          placeholder="Optional for approve · required guidance for feedback to marketing head"
        />
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void decide("approved")}>
          Approve → LinkedIn handler
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !comments.trim()}
          onClick={() => void decide("changes_requested")}
        >
          Send feedback to marketing head
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy || !comments.trim()}
          onClick={() => void decide("rejected")}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
