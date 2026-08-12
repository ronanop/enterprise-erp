"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  ALL_PROCUREMENT_NAV,
  warmProcurementNavTarget,
} from "@/components/procurement/procurement-workspace-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProcurementNavSearch({
  className,
  iconOnly = false,
  iconButtonClassName,
}: {
  className?: string;
  /** Show a search icon; expand the field after click. */
  iconOnly?: boolean;
  iconButtonClassName?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(!iconOnly);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...ALL_PROCUREMENT_NAV];
    return ALL_PROCUREMENT_NAV.filter((item) => item.title.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (iconOnly && !query.trim()) setExpanded(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [iconOnly, query]);

  useEffect(() => {
    if (expanded && iconOnly) {
      inputRef.current?.focus();
      setOpen(true);
    }
  }, [expanded, iconOnly]);

  function goTo(href: string) {
    warmProcurementNavTarget(router, href);
    router.push(href);
    setQuery("");
    setOpen(false);
    if (iconOnly) setExpanded(false);
  }

  function close() {
    setOpen(false);
    if (iconOnly) {
      setExpanded(false);
      setQuery("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex] ?? results[0];
      if (item) goTo(item.href);
      return;
    }
    if (event.key === "Escape") {
      close();
    }
  }

  if (iconOnly && !expanded) {
    return (
      <div ref={rootRef} className={cn("relative", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Search procurement pages"
          className={cn(
            "size-8 cursor-pointer rounded-lg border-border bg-background text-foreground shadow-none transition-colors duration-200 hover:bg-muted",
            iconButtonClassName,
          )}
          onClick={() => setExpanded(true)}
        >
          <Search className="size-4" strokeWidth={2.5} />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-0",
        iconOnly ? "w-[min(260px,calc(100vw-8rem))]" : "w-full sm:w-[260px]",
        className,
      )}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search sidebar…"
          aria-label="Search procurement sidebar pages"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          className={cn(
            "h-9 cursor-text rounded-xl border-border/70 bg-background pl-9 text-sm shadow-none transition-colors duration-200",
            iconOnly && "h-8",
          )}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 max-h-72 w-full min-w-[220px] overflow-y-auto rounded-xl border border-border/80 bg-card p-1 shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">No matching pages</li>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <li key={item.href} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150",
                      active
                        ? "bg-[#0F172A] font-medium text-white"
                        : "font-normal text-foreground hover:bg-muted/70",
                    )}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      warmProcurementNavTarget(router, item.href);
                    }}
                    onClick={() => goTo(item.href)}
                  >
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        active ? "text-white" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{item.title}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
