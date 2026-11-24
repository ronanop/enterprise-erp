"use client";

import Link from "next/link";

import { EmptyState, StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import type { WizardAssetOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { assignmentNavigationPaths } from "@/components/assets/navigation/assignment-navigation";
import { Button } from "@/components/ui/button";

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
  assets = [],
  unavailableAssetMessage,
  onClearUnavailableAsset,
}: AssetStepProps) {
  const selected = assets.find((a) => a.id === state.assetId) ?? null;

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
        ) : (
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
            <Link href={assignmentNavigationPaths.inventory}>Back to All Assets</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!state.assetId || !selected) {
    return (
      <div className="space-y-3" data-testid="assignment-asset-locked-empty">
        <EmptyState
          variant="no-assets"
          title="No asset selected"
          description="Open All Assets and choose Assign on the asset you want to issue."
          compact
        />
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
          <Link href={assignmentNavigationPaths.inventory}>Open All Assets</Link>
        </Button>
      </div>
    );
  }

  const makeModel = [selected.make, selected.model].filter((v) => v && v !== "—").join(" · ");

  return (
    <div className="grid max-w-2xl gap-3" data-testid="assignment-asset-selected">
      <div className="rounded-lg border border-[#0369A1]/25 bg-[rgba(3,105,161,0.06)] px-3 py-3 text-sm">
        <p className="text-[11px] font-medium tracking-wide text-[#0369A1] uppercase">Selected asset</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{selected.code}</span>
          <span className="font-medium text-foreground">{selected.label}</span>
          {isOperationalStatus(selected.operationalStatus) ? (
            <StatusBadge kind="operational" status={selected.operationalStatus} />
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          S/N: {selected.serialNumber ?? "—"}
          {makeModel ? ` · ${makeModel}` : ""}
          {selected.locationLabel ? ` · ${selected.locationLabel}` : ""}
        </p>
      </div>
    </div>
  );
}
