"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import type { WizardAssetOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_ASSETS } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");
  const selected = assets.find((a) => a.id === state.assetId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const hay = [a.code, a.label, a.serialNumber, a.make, a.model, a.locationLabel, a.branchLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [assets, query]);

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
    <div className="grid max-w-2xl gap-3">
      <p className="text-xs text-muted-foreground">
        {assets === MOCK_ASSETS
          ? "Showing demo assets (API integration in next phase)."
          : "Only assets with Operational Status Ready to Move are listed."}
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search code, name, serial…"
          className="h-9 pl-8"
          aria-label="Search ready assets"
        />
      </div>

      <ul
        className="m-0 max-h-[min(20rem,45vh)] list-none space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-muted/10 p-1"
        role="listbox"
        aria-label="Select asset"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            No assets match “{query.trim()}”.
          </li>
        ) : (
          filtered.map((asset) => {
            const active = state.assetId === asset.id;
            const makeModel = [asset.make, asset.model].filter((v) => v && v !== "—").join(" · ");
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-150",
                    active
                      ? "bg-[rgba(3,105,161,0.1)] ring-1 ring-[#0369A1]/40"
                      : "hover:bg-background/90",
                  )}
                  onClick={() =>
                    onChange({
                      assetId: asset.id,
                      branchId: asset.branchId || state.branchId,
                    })
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{asset.code}</span>
                    <span className="font-medium text-foreground">{asset.label}</span>
                    {isOperationalStatus(asset.operationalStatus) ? (
                      <StatusBadge kind="operational" status={asset.operationalStatus} />
                    ) : null}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    S/N: {asset.serialNumber ?? "—"}
                    {makeModel ? ` · ${makeModel}` : ""}
                    {asset.locationLabel ? ` · ${asset.locationLabel}` : ""}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {selected ? (
        <div className="rounded-lg border border-[#0369A1]/25 bg-[rgba(3,105,161,0.06)] px-3 py-2 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#0369A1]">Selected</p>
          <p className="mt-0.5 font-medium">
            {selected.code} · {selected.label}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select an asset to continue.</p>
      )}
    </div>
  );
}
