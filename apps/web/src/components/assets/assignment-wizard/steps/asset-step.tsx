"use client";

import { EmptyState, StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import type { WizardAssetOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_ASSETS } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AssetStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  assets?: WizardAssetOption[];
  /** Deep-linked asset is no longer READY_TO_MOVE / eligible. */
  unavailableAssetMessage?: string | null;
  onClearUnavailableAsset?: () => void;
};

export function AssetStep({
  state,
  onChange,
  assets = MOCK_ASSETS,
  unavailableAssetMessage,
  onClearUnavailableAsset,
}: AssetStepProps) {
  const selected = assets.find((a) => a.id === state.assetId);

  if (unavailableAssetMessage) {
    return (
      <div className="space-y-3" data-testid="assignment-asset-unavailable">
        <EmptyState
          variant="no-assets"
          title="This asset is no longer available for assignment."
          description={unavailableAssetMessage}
          compact
        />
        {onClearUnavailableAsset ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={onClearUnavailableAsset}
          >
            Choose another asset
          </Button>
        ) : null}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div data-testid="assignment-no-ready-assets">
        <EmptyState
          variant="no-assets"
          title="No assets are currently ready to move."
          description="Register and approve an asset before assigning it."
          compact
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs text-muted-foreground">
        {assets === MOCK_ASSETS
          ? "Showing demo assets (API integration in next phase)."
          : "Only assets with Operational Status Ready to Move are listed."}
      </p>
      <ul className="m-0 list-none space-y-2 p-0" role="listbox" aria-label="Select asset">
        {assets.map((asset) => {
          const active = state.assetId === asset.id;
          const makeModel = [asset.make, asset.model].filter((v) => v && v !== "—").join(" · ");
          return (
            <li key={asset.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
                onClick={() =>
                  onChange({
                    assetId: asset.id,
                    branchId: asset.branchId || state.branchId,
                  })
                }
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{asset.code}</span>
                  <span className="font-medium">{asset.label}</span>
                  {isOperationalStatus(asset.operationalStatus) ? (
                    <StatusBadge kind="operational" status={asset.operationalStatus} />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  S/N: {asset.serialNumber ?? "—"}
                  {makeModel ? ` · ${makeModel}` : ""}
                  {asset.locationLabel ? ` · ${asset.locationLabel}` : ""}
                  {asset.branchLabel ? ` · ${asset.branchLabel}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected ? (
        <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Selected</p>
          <p>
            {selected.code} · {selected.label}
          </p>
        </div>
      ) : null}
    </div>
  );
}
