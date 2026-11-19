"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut } from "lucide-react";

import { SignedInUserIdentity } from "@/components/layout/signed-in-user-identity";
import { cn } from "@/lib/utils";

type UserAccountMenuProps = {
  onSignOut: () => void | Promise<void>;
  className?: string;
  variant?: "topbar" | "sidebar";
  collapsed?: boolean;
};

export function UserAccountMenu({
  onSignOut,
  className,
  variant = "topbar",
  collapsed = false,
}: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const menuWidth = menu?.offsetWidth ?? 220;
    const menuHeight = menu?.offsetHeight ?? 120;
    const gap = 6;
    const pad = 8;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - gap - menuHeight);
    }

    let left = rect.right - menuWidth;
    left = Math.min(Math.max(pad, left), window.innerWidth - menuWidth - pad);
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
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
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  const isSidebar = variant === "sidebar";

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex w-full max-w-full cursor-pointer items-center gap-1 rounded-lg border border-transparent text-left transition-colors duration-200",
          isSidebar
            ? cn(
              "px-0 py-0",
              !collapsed && "hover:bg-sidebar-accent/40",
              open && !collapsed && "bg-sidebar-accent/40",
            )
            : cn(
              "max-w-[min(100%,280px)] px-1.5 py-1",
              "hover:border-border/80 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              open && "border-border/80 bg-muted/60",
            ),
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <SignedInUserIdentity
          variant={isSidebar ? "sidebar" : "topbar"}
          collapsed={isSidebar ? collapsed : false}
          className="min-w-0 flex-1"
        />
        {!collapsed ? (
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200",
              isSidebar ? "text-sidebar-foreground/55" : "text-muted-foreground",
              open && "rotate-180",
            )}
            aria-hidden
          />
        ) : null}
      </button>

      {mounted && open
        ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[12rem] rounded-xl border border-border bg-card py-1 text-sm shadow-lg"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                setOpen(false);
                void onSignOut();
              }}
            >
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              Sign out
            </button>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
