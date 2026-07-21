"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CoaCommentItem = {
  id: string;
  body: string;
  created_by: string;
  created_at: string;
  source: "comment" | "workflow";
};

type Props = {
  items: CoaCommentItem[];
  resolveUser: (id?: string | null) => string;
  /** When backend comment endpoint exists, wire this. */
  onSubmit?: (comment: string) => Promise<void>;
  readOnly?: boolean;
};

export function CoaCommentsPanel({ items, resolveUser, onSubmit, readOnly }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    [items],
  );

  async function submit() {
    const comment = text.trim();
    if (!comment) return;
    if (!onSubmit) {
      setHint("Comments API is ready for wiring — endpoint not available for COA yet.");
      return;
    }
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await onSubmit(comment);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
      <h3 className="text-sm font-medium tracking-tight">Comments</h3>
      <div className="mt-3 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          sorted.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
              <p className="text-sm">{item.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {resolveUser(item.created_by)} · {item.created_at?.slice(0, 19) ?? "—"} · {item.source}
              </p>
            </div>
          ))
        )}
      </div>
      {!readOnly ? (
        <div className="mt-3 flex gap-2">
          <textarea
            className="min-h-[64px] flex-1 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
            placeholder="Add a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 cursor-pointer gap-1 self-end"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
          >
            <Send className="size-3.5" /> Post
          </Button>
        </div>
      ) : null}
      {hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
