"use client";

import type { AssetDetailDrawerTabId } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { cn } from "@/lib/utils";

export const DRAWER_WORKSPACE_TABS: Array<{ id: AssetDetailDrawerTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "configuration", label: "Configuration" },
  { id: "assignment", label: "Assignment" },
  { id: "history", label: "History" },
  { id: "timeline", label: "Timeline" },
  { id: "documents", label: "Documents" },
];

export type DrawerWorkspaceTabsProps = {
  value: AssetDetailDrawerTabId;
  onChange: (tab: AssetDetailDrawerTabId) => void;
  className?: string;
};

export function DrawerWorkspaceTabs({ value, onChange, className }: DrawerWorkspaceTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Asset detail sections"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border/60 px-3 py-2",
        className,
      )}
      data-testid="drawer-workspace-tabs"
    >
      {DRAWER_WORKSPACE_TABS.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`drawer-tab-${tab.id}`}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
