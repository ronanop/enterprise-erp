"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { addJournalComment } from "@/services/journal-service";

export type JournalCommentItem = {
  id: string;
  body: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  source: "comment" | "workflow";
};

type Props = {
  journalId: string;
  items: JournalCommentItem[];
  resolveUser: (id?: string | null) => string;
  onPosted: () => void;
  readOnly?: boolean;
};

export function JournalCommentsPanel({
  journalId,
  items,
  resolveUser,
  onPosted,
  readOnly,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      ),
    [items],
  );

  async function submit() {
    const comment = text.trim();
    if (!comment) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await addJournalComment(journalId, comment);
      setText("");
      setSuccess("Comment posted.");
      onPosted();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to post comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-medium tracking-tight">Discussion</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Internal comments · newest first
      </p>

      {!readOnly ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Add an internal comment…"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px]">
              {success ? (
                <span className="text-emerald-700">{success}</span>
              ) : error ? (
                <span className="text-destructive">{error}</span>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={busy || !text.trim()}
              onClick={() => void submit()}
            >
              <Send className="size-3.5" />
              {busy ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {sorted.length === 0 ? (
          <li className="text-xs text-muted-foreground">No comments yet.</li>
        ) : (
          sorted.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {item.created_by_name || resolveUser(item.created_by)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString("en-IN")
                    : "—"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground/90">{item.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {item.source}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
