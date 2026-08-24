"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/services/api-client";
import {
  createContentRequest,
  listGeneratedContent,
  type MarketingGeneratedContent,
} from "@/services/marketing-service";

export function MarketingContentStudio() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MarketingGeneratedContent[]>([]);

  const reload = useCallback(async () => {
    try {
      setRows(await listGeneratedContent());
    } catch (err) {
      setError(formatApiError(err, "Failed to load content"));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onGenerate() {
    if (!topic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createContentRequest({
        topic: topic.trim(),
        content_type: "post",
        tone,
        generate_now: true,
      });
      setTopic("");
      await reload();
    } catch (err) {
      setError(formatApiError(err, "Generation failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content Studio"
        description="Generate platform-ready drafts with the marketing agent pipeline."
      />

      <div className="grid gap-3 rounded-md border border-border/70 bg-card p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-1.5">
          <label htmlFor="mkt-topic" className="text-xs font-medium text-muted-foreground">
            Topic
          </label>
          <Input
            id="mkt-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Enterprise AI governance for CFOs"
            className="transition-colors duration-200"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mkt-tone" className="text-xs font-medium text-muted-foreground">
            Tone
          </label>
          <Input
            id="mkt-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="transition-colors duration-200"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !topic.trim()}
          onClick={() => void onGenerate()}
          className="cursor-pointer transition-colors duration-200"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Generate
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No generated content yet.</p>
        ) : (
          rows.map((row) => {
            const overall =
              row.scores && typeof row.scores.overall === "number" ? row.scores.overall : null;
            return (
              <article
                key={row.id}
                className="rounded-md border border-border/70 bg-card p-3 transition-colors duration-200"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {row.headline || "Untitled draft"}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {row.status}
                  </Badge>
                  {overall != null ? (
                    <Badge variant="outline" className="text-[10px]">
                      Score {overall}
                    </Badge>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {row.body}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
