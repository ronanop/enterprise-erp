"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type {
  AssetDetailDrawerActionId,
  AssetDetailDrawerData,
  AssetDetailDrawerTabId,
  InventoryActionPermissions,
  InventoryAssetRef,
  InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { AdditionalInfoSection } from "@/components/assets/inventory/interaction/drawer-sections/additional-info-section";
import { AssignmentHistorySection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-history-section";
import { AssignmentSection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-section";
import { ConfigurationSection } from "@/components/assets/inventory/interaction/drawer-sections/configuration-section";
import { DocumentsSection } from "@/components/assets/inventory/interaction/drawer-sections/documents-section";
import { DrawerActionBar } from "@/components/assets/inventory/interaction/drawer-sections/drawer-action-bar";
import { AssetDetailDrawerSkeleton } from "@/components/assets/inventory/interaction/drawer-sections/drawer-skeleton";
import { DrawerWorkspaceHeader } from "@/components/assets/inventory/interaction/drawer-sections/drawer-workspace-header";
import { DrawerWorkspaceTabs } from "@/components/assets/inventory/interaction/drawer-sections/drawer-workspace-tabs";
import { SummarySection } from "@/components/assets/inventory/interaction/drawer-sections/summary-section";
import { TimelineSection } from "@/components/assets/inventory/interaction/drawer-sections/timeline-section";
import { EmptyState } from "@/components/assets/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AssetDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: InventoryAssetRef | null;
  loading?: boolean;
  data?: AssetDetailDrawerData | null;
  /** @deprecated Prefer bottom action bar — kept for quick-link regression. */
  quickLinkEnabled?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onQuickLink?: (link: InventoryQuickLinkId, asset: InventoryAssetRef) => void;
  actionPermissions?: Partial<InventoryActionPermissions>;
  onAction?: (action: AssetDetailDrawerActionId, asset: InventoryAssetRef) => void;
  initialTab?: AssetDetailDrawerTabId;
  className?: string;
};

function OverviewTab({ data }: { data: AssetDetailDrawerData }) {
  return (
    <div className="space-y-5 divide-y divide-border/60">
      <div className="space-y-5 pb-5">
        <SummarySection
          assetTag={data.assetTag}
          laptopName={data.laptopName}
          currentHolder={data.currentHolder}
          branch={data.branch}
          operationalStatus={data.operationalStatus}
          lifecycleStatus={data.lifecycleStatus}
        />
      </div>
      <section aria-labelledby="drawer-purchase-heading" className="space-y-3 py-5">
        <h3 id="drawer-purchase-heading" className="text-sm font-medium tracking-tight">
          Purchase information
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Manufacturer</dt>
            <dd className="mt-0.5 text-sm">{data.manufacturer}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Model</dt>
            <dd className="mt-0.5 text-sm">{data.model}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="drawer-location-heading" className="space-y-3 py-5">
        <h3 id="drawer-location-heading" className="text-sm font-medium tracking-tight">
          Location
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Location</dt>
            <dd className="mt-0.5 text-sm">{data.location}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Branch</dt>
            <dd className="mt-0.5 text-sm">{data.branch}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="drawer-holder-heading" className="space-y-3 py-5">
        <h3 id="drawer-holder-heading" className="text-sm font-medium tracking-tight">
          Current holder
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Holder</dt>
            <dd className="mt-0.5 text-sm">{data.currentHolder}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Employee ID</dt>
            <dd className="mt-0.5 font-mono text-sm">{data.employeeId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Department</dt>
            <dd className="mt-0.5 text-sm">{data.department}</dd>
          </div>
        </dl>
      </section>
      <div className="pt-5">
        <AdditionalInfoSection additional={data.additional} />
      </div>
    </div>
  );
}

export function AssetDetailDrawer({
  open,
  onOpenChange,
  asset,
  loading,
  data,
  quickLinkEnabled: _quickLinkEnabled,
  onQuickLink,
  actionPermissions,
  onAction,
  initialTab = "overview",
  className,
}: AssetDetailDrawerProps) {
  const [tab, setTab] = useState<AssetDetailDrawerTabId>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, data?.assetTag]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="asset-detail-drawer">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
        aria-label="Close drawer overlay"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-drawer-title"
        className={cn(
          // Mobile full-screen; tablet ~50%; desktop ~35%
          "relative flex h-full w-full flex-col border-l border-border bg-card shadow-xl",
          "md:w-1/2 md:max-w-none",
          "xl:w-[35%] xl:max-w-xl",
          className,
        )}
        data-testid="asset-detail-drawer-panel"
      >
        <div className="flex items-center justify-end border-b border-border/40 px-2 py-1 md:absolute md:right-2 md:top-2 md:z-10 md:border-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close drawer"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AssetDetailDrawerSkeleton />
          </div>
        ) : !data ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <EmptyState
              variant="no-assets"
              title="No asset selected"
              description="Choose an asset from the inventory list to preview details."
            />
          </div>
        ) : (
          <>
            <DrawerWorkspaceHeader data={data} />
            <DrawerWorkspaceTabs value={tab} onChange={setTab} />
            <div
              className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-4 motion-reduce:scroll-auto"
              role="tabpanel"
              aria-labelledby={`drawer-tab-${tab}`}
              data-testid={`drawer-tab-panel-${tab}`}
            >
              {tab === "overview" ? <OverviewTab data={data} /> : null}
              {tab === "configuration" ? (
                <ConfigurationSection
                  configuration={data.configuration}
                  parts={data.configurationParts}
                />
              ) : null}
              {tab === "assignment" ? <AssignmentSection assignment={data.assignment} /> : null}
              {tab === "history" ? <AssignmentHistorySection history={data.history} /> : null}
              {tab === "timeline" ? <TimelineSection events={data.timeline} /> : null}
              {tab === "documents" ? (
                <DocumentsSection
                  data={data}
                  onOpenQr={
                    asset && onAction
                      ? () => onAction("printQr", asset)
                      : asset && onQuickLink
                        ? () => onQuickLink("qr", asset)
                        : undefined
                  }
                />
              ) : null}
            </div>
            <DrawerActionBar
              asset={asset}
              permissions={actionPermissions}
              operationalStatus={data.operationalStatus}
              onAction={onAction}
            />
          </>
        )}
      </aside>
    </div>
  );
}
