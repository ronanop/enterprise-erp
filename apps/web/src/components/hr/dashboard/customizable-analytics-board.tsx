"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GripVertical, Pencil, Save } from "lucide-react";

import { ChartHeightContext } from "@/components/hr/dashboard/hr-analytics-charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnalyticsLayoutItem = {
  id: string;
  /** Column span 1–12 on large screens */
  colSpan: number;
  /** Total card height in px (includes title + padding) */
  height: number;
};

/** Bumped so prior uneven layouts are reset once. */
const STORAGE_KEY = "erp_hr_analytics_layout_v2";

/** Space reserved for ChartShell title row + padding. */
export const CHART_SHELL_CHROME = 64;
/** Space reserved for edit toolbar when editing. */
const EDIT_TOOLBAR_H = 40;

type Props = {
  items: { id: string; defaultColSpan?: number; defaultHeight?: number; node: ReactNode }[];
};

function loadLayout(defaults: AnalyticsLayoutItem[]): AnalyticsLayoutItem[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as AnalyticsLayoutItem[];
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    const byId = new Map(parsed.map((p) => [p.id, p]));
    const ordered: AnalyticsLayoutItem[] = [];
    for (const p of parsed) {
      if (defaults.some((d) => d.id === p.id)) {
        ordered.push({
          id: p.id,
          colSpan: Math.min(12, Math.max(3, Number(p.colSpan) || 12)),
          height: Math.min(720, Math.max(220, Number(p.height) || 300)),
        });
      }
    }
    for (const d of defaults) {
      if (!byId.has(d.id)) ordered.push(d);
    }
    return ordered.length ? ordered : defaults;
  } catch {
    return defaults;
  }
}

export function CustomizableAnalyticsBoard({ items }: Props) {
  const defaults = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        colSpan: it.defaultColSpan ?? 12,
        height: it.defaultHeight ?? 300,
      })),
    [items],
  );

  const [layout, setLayout] = useState<AnalyticsLayoutItem[]>(defaults);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setLayout(loadLayout(defaults));
  }, [defaults]);

  const nodeById = useMemo(() => {
    const m = new Map<string, ReactNode>();
    for (const it of items) m.set(it.id, it.node);
    return m;
  }, [items]);

  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
    setEditing(false);
  }, [layout]);

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    setLayout((prev) => {
      const next = [...prev];
      const from = next.findIndex((x) => x.id === dragId);
      const to = next.findIndex((x) => x.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  }

  function patchItem(id: string, patch: Partial<AnalyticsLayoutItem>) {
    setLayout((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">HR Analytics</h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <Button size="sm" className="cursor-pointer" onClick={save}>
              <Save className="size-3.5" />
              Save layout
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 items-stretch gap-4">
        {layout.map((item) => {
          const node = nodeById.get(item.id);
          if (!node) return null;
          const plotHeight = Math.max(
            180,
            item.height - CHART_SHELL_CHROME - (editing ? EDIT_TOOLBAR_H : 0),
          );
          return (
            <div
              key={item.id}
              className={cn(
                "col-span-12 flex min-h-0 flex-col",
                editing && "rounded-2xl outline outline-1 outline-primary/30",
              )}
              style={{
                gridColumn: `span ${item.colSpan} / span ${item.colSpan}`,
                height: item.height,
              }}
              draggable={editing}
              onDragStart={() => editing && setDragId(item.id)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => editing && onDrop(item.id)}
            >
              {editing ? (
                <div
                  className="flex h-10 shrink-0 flex-wrap items-center gap-2 rounded-t-2xl border border-b-0 border-dashed border-primary/30 bg-primary/5 px-2.5 text-[11px] text-muted-foreground"
                  style={{ height: EDIT_TOOLBAR_H }}
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab" />
                  <span className="font-medium text-foreground">Drag to reorder</span>
                  <label className="ml-auto flex items-center gap-1">
                    Width
                    <select
                      className="h-7 cursor-pointer rounded border border-input bg-background px-1"
                      value={item.colSpan}
                      onChange={(e) =>
                        patchItem(item.id, { colSpan: Number(e.target.value) })
                      }
                    >
                      <option value={12}>Full</option>
                      <option value={6}>Half</option>
                      <option value={4}>1/3</option>
                      <option value={8}>2/3</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Height
                    <input
                      type="number"
                      min={220}
                      max={720}
                      step={20}
                      className="h-7 w-16 rounded border border-input bg-background px-1.5 font-mono"
                      value={item.height}
                      onChange={(e) =>
                        patchItem(item.id, {
                          height: Math.min(720, Math.max(220, Number(e.target.value) || 300)),
                        })
                      }
                    />
                    px
                  </label>
                </div>
              ) : null}
              <div
                className={cn("min-h-0 flex-1", editing && "overflow-hidden rounded-b-2xl")}
              >
                <ChartHeightContext.Provider value={plotHeight}>
                  {node}
                </ChartHeightContext.Provider>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
