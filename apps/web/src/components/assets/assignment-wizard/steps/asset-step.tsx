"use client";

import { EmptyState } from "@/components/assets/shared";
import type { WizardAssetOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_ASSETS } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

export type AssetStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  assets?: WizardAssetOption[];
};

export function AssetStep({ state, onChange, assets = MOCK_ASSETS }: AssetStepProps) {
  const selected = assets.find((a) => a.id === state.assetId);

  if (assets.length === 0) {
    return (
      <EmptyState
        variant="no-assets"
        title="No ready assets"
        description="Adjust filters or register assets in Ready To Move status."
        compact
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs text-muted-foreground">
        {assets === MOCK_ASSETS
          ? "Showing demo assets (API integration in next phase)."
          : "Assets in Ready To Move status."}
      </p>
      <ul className="m-0 list-none space-y-2 p-0" role="listbox" aria-label="Select asset">
        {assets.map((asset) => {
          const active = state.assetId === asset.id;
          return (
            <li key={asset.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
                onClick={() =>
                  onChange({
                    assetId: asset.id,
                    branchId: asset.branchId || state.branchId,
                  })
                }
              >
                <span>
                  <span className="font-mono text-xs text-muted-foreground">{asset.code}</span>
                  <span className="ml-2 font-medium">{asset.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {asset.branchLabel} · {asset.operationalStatus}
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
