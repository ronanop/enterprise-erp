"use client";

import { EmptyState } from "@/components/assets/shared";
import type { WizardAssetOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

export type AssetStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  assets?: WizardAssetOption[];
  /** Seeded from drawer/query; hide asset chooser and show read-only details. */
  prefilledAsset?: boolean;
  /** When true, selection is locked (post-activation / view). */
  lockAsset?: boolean;
  readOnly?: boolean;
};

export function AssetStep({
  state,
  onChange,
  assets = [],
  prefilledAsset,
  lockAsset,
  readOnly,
}: AssetStepProps) {
  const selected = assets.find((a) => a.id === state.assetId);
  const locked = Boolean(prefilledAsset || lockAsset || readOnly);

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
    <div className="grid gap-4" data-testid="asset-information-section">
      <h3 className="text-sm font-medium tracking-tight">Asset Information</h3>
      {prefilledAsset ? (
        <p className="text-xs text-muted-foreground">
          Asset was prefilled from the register drawer and cannot be changed here.
        </p>
      ) : locked ? (
        <p className="text-xs text-muted-foreground">
          Assigned asset cannot be changed after activation.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Select a Ready To Move asset.</p>
      )}

      {!locked ? (
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
      ) : null}

      {selected ? (
        <div className="grid gap-3 rounded-md border border-border/80 bg-muted/20 p-3 sm:grid-cols-2">
          <Info label="Asset Tag" value={selected.code} mono />
          <Info label="Asset Name" value={selected.label} />
          <Info label="Serial Number" value={selected.serialNumber || "—"} mono />
          <Info label="Make" value={selected.make || "—"} />
          <Info label="Model" value={selected.model || "—"} />
          <Info label="Configuration" value={selected.configuration || "—"} />
          <Info label="Branch" value={selected.branchLabel || "—"} />
          <Info label="Current Status" value={selected.operationalStatus || "—"} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {prefilledAsset
            ? "Asset details could not be loaded."
            : "Select an asset to view details."}
        </p>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
