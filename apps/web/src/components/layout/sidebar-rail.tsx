"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type RefObject,
} from "react";

import { cn } from "@/lib/utils";

/** Figma motion: Expanded 260 ↔ Collapsed 72 (see design-system pages/app-shell.md). */
export const SIDEBAR_EXPANDED = 260;
export const SIDEBAR_COLLAPSED = 72;
export const SIDEBAR_WIDTH_MS = 320;
export const SIDEBAR_LABEL_MS = 160;
export const SIDEBAR_SEARCH_MS = 220;
export const SIDEBAR_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

const NARROW_VIEWPORT = "(max-width: 767px)";

function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

export function prefersReducedMotion(): boolean {
  return matchesMedia("(prefers-reduced-motion: reduce)");
}

function subscribeNarrowViewport(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => { };
  const query = window.matchMedia(NARROW_VIEWPORT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Collapse state shared by every left sidebar. Spacer and rail share the same width
 * transition so the workspace does not flash an empty gap while the rail animates.
 * `erp-sidebar-animating` freezes chart thrash for the duration. Follows the viewport
 * (collapsed on phone widths) until the user toggles it.
 */
export function useSidebarCollapse() {
  const narrow = useSyncExternalStore(
    subscribeNarrowViewport,
    () => matchesMedia(NARROW_VIEWPORT),
    () => false,
  );
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const [animating, setAnimating] = useState(false);
  const timer = useRef<number | null>(null);
  const collapsed = userCollapsed ?? narrow;

  useEffect(() => {
    document.documentElement.classList.toggle("erp-sidebar-animating", animating);
    return () => document.documentElement.classList.remove("erp-sidebar-animating");
  }, [animating]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const toggle = useCallback(() => {
    setUserCollapsed(!collapsed);
    if (prefersReducedMotion()) {
      setAnimating(false);
      return;
    }
    setAnimating(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnimating(false), SIDEBAR_WIDTH_MS + 40);
  }, [collapsed]);

  return { collapsed, layoutCollapsed: collapsed, toggle };
}

type SidebarRailProps = ComponentProps<"aside"> & {
  collapsed: boolean;
  layoutCollapsed: boolean;
};

/**
 * Keep wheel/trackpad gestures inside the fixed sidebar. Manually apply delta to the
 * nav scroller and always preventDefault so browsers cannot chain into the main page.
 */
function useSidebarScrollIsolation(asideRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const findScrollable = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const node = target.closest(
        "[data-sidebar-scroll], .overflow-y-auto, .overflow-auto, .erp-scroll",
      );
      if (node instanceof HTMLElement && aside.contains(node)) return node;
      return aside.querySelector<HTMLElement>("[data-sidebar-scroll]");
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;

      const scrollable = findScrollable(event.target);
      if (scrollable) {
        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
        if (maxScroll > 1) {
          const next = Math.min(
            maxScroll,
            Math.max(0, scrollable.scrollTop + event.deltaY),
          );
          if (next !== scrollable.scrollTop) {
            scrollable.scrollTop = next;
          }
        }
      }

      event.preventDefault();
      event.stopPropagation();
    };

    aside.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => aside.removeEventListener("wheel", onWheel, { capture: true });
  }, [asideRef]);
}

/** Left rail: an in-flow spacer plus the fixed, width-animated `<aside>`. */
export function SidebarRail({
  collapsed,
  layoutCollapsed,
  className,
  children,
  ...rest
}: SidebarRailProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  useSidebarScrollIsolation(asideRef);

  return (
    <>
      <div
        aria-hidden
        data-erp-sidebar-spacer
        className={cn(
          "h-dvh shrink-0 transition-[width] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          layoutCollapsed ? "w-[72px]" : "w-[260px]",
        )}
      />
      <aside
        data-erp-primary-sidebar
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "fixed top-0 left-0 z-20 flex h-dvh flex-col overflow-hidden overscroll-none border-r border-sidebar-border text-sidebar-foreground",
          "bg-[linear-gradient(165deg,var(--sidebar-hero-from)_0%,var(--sidebar-hero-via)_45%,var(--sidebar-hero-to)_100%)]",
          "transform-gpu transition-[width] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[width] [backface-visibility:hidden] motion-reduce:transition-none",
          collapsed ? "w-[72px]" : "w-[260px]",
          className,
        )}
        {...rest}
        ref={asideRef}
      >
        {children}
      </aside>
    </>
  );
}
