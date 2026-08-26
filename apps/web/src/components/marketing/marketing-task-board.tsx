"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ListTodo } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/services/api-client";
import {
  createMarketingTask,
  executeMarketingTask,
  listMarketingTasks,
  type MarketingTask,
} from "@/services/marketing-service";

export function MarketingTaskBoard({ mineOnly = false }: { mineOnly?: boolean }) {
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MarketingTask[]>([]);

  const reload = useCallback(async () => {
    try {
      setRows(await listMarketingTasks(mineOnly));
    } catch (err) {
      setError(formatApiError(err, "Failed to load tasks"));
    }
  }, [mineOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createMarketingTask({
        title: title.trim(),
        estimated_hours: Number(hours) || 1,
        task_kind: "general",
      });
      setTitle("");
      await reload();
    } catch (err) {
      setError(formatApiError(err, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onExecute(id: string) {
    setBusy(true);
    setError(null);
    try {
      await executeMarketingTask(id);
      await reload();
    } catch (err) {
      setError(formatApiError(err, "Execute failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={mineOnly ? "My Work" : "Task execution"}
        description="Heads and managers can execute personally, delegate, or split work (hybrid)."
      />
      {!mineOnly ? (
        <div className="grid gap-3 rounded-md border border-border/70 bg-card p-4 md:grid-cols-[1fr_120px_auto] md:items-end">
          <div className="space-y-1.5">
            <label htmlFor="mkt-task-title" className="text-xs font-medium text-muted-foreground">
              Task title
            </label>
            <Input
              id="mkt-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Draft product launch blog"
              className="transition-colors duration-200"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mkt-task-hours" className="text-xs font-medium text-muted-foreground">
              Est. hours
            </label>
            <Input
              id="mkt-task-hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="transition-colors duration-200"
            />
          </div>
          <Button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void onCreate()}
            className="cursor-pointer transition-colors duration-200"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ListTodo className="size-3.5" />}
            Create task
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-border/60 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Mode</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Hours</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                  No tasks yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-mono">{row.task_code}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.title}</span>
                    {row.is_urgent ? (
                      <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                        Urgent
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.execution_mode}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {row.actual_hours ?? 0}/{row.estimated_hours ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer transition-colors duration-200"
                      onClick={() => void onExecute(row.id)}
                    >
                      Execute
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
