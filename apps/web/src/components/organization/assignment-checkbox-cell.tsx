"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AssignmentOption = { id: string; label: string };

type AssignmentCheckboxCellProps = {
  label: string;
  options: AssignmentOption[];
  selectedIds: string[];
  canEdit: boolean;
  /** When true, selecting one option clears the others (department). */
  single?: boolean;
  emptyLabel?: string;
  onSave: (ids: string[]) => Promise<void>;
};

/**
 * Dense table cell: badges + checkbox popover for org assignments.
 */
export function AssignmentCheckboxCell({
  label,
  options,
  selectedIds,
  canEdit,
  single = false,
  emptyLabel = "None",
  onSave,
}: AssignmentCheckboxCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setDraft(selectedIds);
  }, [selectedIds]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 280;
    const height = panel?.offsetHeight ?? 320;
    const pad = 8;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - height - 6);
    }
    let left = rect.left;
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const labelById = new Map(options.map((o) => [o.id, o.label]));
  const visible = selectedIds.slice(0, 2);
  const extra = selectedIds.length - visible.length;

  function toggle(id: string, checked: boolean) {
    if (single) {
      setDraft(checked ? [id] : []);
      return;
    }
    setDraft((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedIds.length === 0 ? (
        <span className="text-xs text-muted-foreground">{emptyLabel}</span>
      ) : (
        <>
          {visible.map((id) => (
            <Badge key={id} variant="outline" className="max-w-[140px] truncate font-normal">
              {labelById.get(id) ?? id.slice(0, 8)}
            </Badge>
          ))}
          {extra > 0 ? (
            <Badge variant="outline" className="font-normal">
              +{extra}
            </Badge>
          ) : null}
        </>
      )}
      {canEdit ? (
        <Button
          ref={triggerRef}
          type="button"
          size="icon-xs"
          variant="ghost"
          className="size-7 cursor-pointer transition-colors duration-200"
          aria-label={`Assign ${label}`}
          onClick={() => {
            setDraft(selectedIds);
            setError(null);
            setOpen((v) => !v);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : null}

      {mounted && open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[200] w-[min(300px,calc(100vw-16px))] rounded-xl border border-border bg-card p-3 shadow-lg"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? "visible" : "hidden",
              }}
            >
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {single ? "Select one option." : "Select all that apply."}
              </p>
              <div className="erp-scroll mt-3 max-h-[240px] space-y-1 overflow-y-auto pr-1">
                {options.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No options available.</p>
                ) : (
                  options.map((opt) => {
                    const checked = draft.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-muted/80",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-3.5 cursor-pointer accent-primary"
                          checked={checked}
                          onChange={() => toggle(opt.id, !checked)}
                        />
                        <span className="font-medium text-foreground">{opt.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 cursor-pointer transition-colors duration-200"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer transition-colors duration-200"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
