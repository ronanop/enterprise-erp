"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type {
  AssetDetailDrawerData,
  InventoryAssetRef,
  InventoryQuickLinkId,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { AdditionalInfoSection } from "@/components/assets/inventory/interaction/drawer-sections/additional-info-section";
import { AssignmentHistorySection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-history-section";
import { AssignmentSection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-section";
import { ConfigurationSection } from "@/components/assets/inventory/interaction/drawer-sections/configuration-section";
import { AssetDetailDrawerSkeleton } from "@/components/assets/inventory/interaction/drawer-sections/drawer-skeleton";
import { QuickLinksSection } from "@/components/assets/inventory/interaction/drawer-sections/quick-links-section";
import { SummarySection } from "@/components/assets/inventory/interaction/drawer-sections/summary-section";
import { InventoryRegisterGroups } from "@/components/assets/inventory/inventory-register-groups";
import {
  DcChallanDocumentPreviewModal,
  type DcChallanDocumentPreviewState,
} from "@/components/assets/dc-challan/dc-challan-document-preview-modal";
import { isOpenDcChallanStatus } from "@/components/assets/navigation/dc-challan-navigation";
import { EmptyState, StatusBadge } from "@/components/assets/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DcChallanRow } from "@/services/assets-service";

export type AssetDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: InventoryAssetRef | null;
  loading?: boolean;
  data?: AssetDetailDrawerData | null;
  quickLinkEnabled?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onQuickLink?: (link: InventoryQuickLinkId, asset: InventoryAssetRef) => void;
  onCreateDcChallan?: () => void;
  dcChallan?: DcChallanRow | null;
  dcChallanLoading?: boolean;
  className?: string;
};

export function AssetDetailDrawer({
  open,
  onOpenChange,
  asset,
  loading,
  data,
  quickLinkEnabled,
  onQuickLink,
  onCreateDcChallan,
  dcChallan = undefined,
  dcChallanLoading = false,
  className,
}: AssetDetailDrawerProps) {
  const [preview, setPreview] = useState<DcChallanDocumentPreviewState | null>(null);
  const showCreateDc = Boolean(onCreateDcChallan) && !isOpenDcChallanStatus(dcChallan?.status);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      return;
    }
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
        className="absolute inset-0 cursor-pointer bg-black/40 motion-reduce:transition-none"
        aria-label="Close drawer overlay"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-drawer-title"
        className={cn(
          "relative flex h-full w-full flex-col border-l border-border bg-card shadow-lg sm:w-[420px] lg:w-[480px]",
          className,
        )}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-card px-4 py-4">
          <div className="min-w-0">
            <h2 id="asset-detail-drawer-title" className="truncate text-lg font-medium tracking-tight">
              {loading ? "Loading…" : (data?.laptopName ?? "Asset details")}
            </h2>
            {!loading && data ? (
              <>
                <p className="font-mono text-xs text-muted-foreground">{data.assetTag}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StatusBadge kind="operational" status={data.operationalStatus} />
                  <StatusBadge kind="lifecycle" status={data.lifecycleStatus} />
                  {showCreateDc ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      onClick={onCreateDcChallan}
                    >
                      Create DC Challan
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
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
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <AssetDetailDrawerSkeleton />
          ) : !data ? (
            <EmptyState
              variant="no-assets"
              title="No asset selected"
              description="Choose an asset from the inventory list to preview details."
            />
          ) : (
            <div className="space-y-6 pb-4">
              <SummarySection
                assetTag={data.assetTag}
                laptopName={data.laptopName}
                currentHolder={data.currentHolder}
                branch={data.branch}
                operationalStatus={data.operationalStatus}
                lifecycleStatus={data.lifecycleStatus}
              />
              {data.registerGroups ? (
                <InventoryRegisterGroups
                  model={data.registerGroups}
                  compact={false}
                  onCreateDcChallan={showCreateDc ? onCreateDcChallan : undefined}
                  dcChallan={dcChallan}
                  dcChallanLoading={dcChallanLoading}
                  onViewDcDocument={
                    dcChallan
                      ? (kind, document) => setPreview({ row: dcChallan, kind, document })
                      : undefined
                  }
                />
              ) : (
                <>
                  <AssignmentSection assignment={data.assignment} />
                  <ConfigurationSection configuration={data.configuration} />
                  <AdditionalInfoSection additional={data.additional} />
                </>
              )}
              <AssignmentHistorySection history={data.history} />
              <QuickLinksSection
                enabledLinks={quickLinkEnabled}
                onQuickLinkPress={
                  asset && onQuickLink
                    ? (id) => onQuickLink(id, asset)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </aside>
      <DcChallanDocumentPreviewModal open={preview} onOpenChange={setPreview} />
    </div>
  );
}
