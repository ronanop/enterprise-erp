"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";

import { erpModules } from "@/config/modules";
import { isModuleAdmin } from "@/lib/module-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateUserModules } from "@/services/foundation-users-service";

type Props = {
  userId: string;
  userType: string;
  assignedModuleKeys: string[];
  adminModuleKeys: string[];
  canEdit: boolean;
  onSaved: (assignedModuleKeys: string[], adminModuleKeys: string[]) => void;
};

export function UserModulesCell({
  userId,
  userType,
  assignedModuleKeys,
  adminModuleKeys,
  canEdit,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(adminModuleKeys);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setDraft(adminModuleKeys);
  }, [adminModuleKeys]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 320;
    const height = panel?.offsetHeight ?? 360;
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

  if (isModuleAdmin(userType)) {
    return (
      <Badge variant="secondary" className="font-normal">
        All modules
      </Badge>
    );
  }

  const memberOnlyKeys = assignedModuleKeys.filter((key) => !adminModuleKeys.includes(key));
  const visible = adminModuleKeys.slice(0, 3);
  const extra = adminModuleKeys.length - visible.length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUserModules(userId, draft);
      onSaved(updated.assigned_module_keys, updated.admin_module_keys ?? []);
      setOpen(false);
    } catch {
      setError("Could not save modules");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {adminModuleKeys.length === 0 && memberOnlyKeys.length === 0 ? (
        <span className="text-xs text-muted-foreground">None</span>
      ) : (
        <>
          {visible.map((key) => (
            <Badge key={key} variant="outline" className="font-normal">
              {erpModules.find((m) => m.key === key)?.title ?? key}
            </Badge>
          ))}
          {extra > 0 ? (
            <Badge variant="outline" className="font-normal">
              +{extra}
            </Badge>
          ) : null}
          {memberOnlyKeys.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              +{memberOnlyKeys.length} member
            </span>
          ) : null}
        </>
      )}
      {canEdit ? (
        <Button
          ref={triggerRef}
          type="button"
          size="icon-xs"
          variant="ghost"
          className="size-7 cursor-pointer"
          aria-label="Assign module admins"
          onClick={() => {
            setDraft(adminModuleKeys);
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
            className="fixed z-[200] w-[min(320px,calc(100vw-16px))] rounded-xl border border-border bg-card p-3 shadow-lg"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            <p className="text-xs font-semibold text-foreground">Module admins</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Selected people get the same module panel as ERP admin, plus a Users tab to assign module users.
            </p>
            <div className="erp-scroll mt-3 max-h-[240px] space-y-1 overflow-y-auto pr-1">
              {erpModules.map((mod) => {
                const checked = draft.includes(mod.key);
                return (
                  <label
                    key={mod.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/80",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 cursor-pointer accent-primary"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) =>
                          checked ? prev.filter((k) => k !== mod.key) : [...prev, mod.key],
                        );
                      }}
                    />
                    <span>
                      <span className="font-medium text-foreground">{mod.title}</span>
                      <span className="block text-[10px] text-muted-foreground">{mod.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 cursor-pointer"
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
