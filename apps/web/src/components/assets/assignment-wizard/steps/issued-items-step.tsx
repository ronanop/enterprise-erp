"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/assets/shared";
import type { WizardIssuedItemOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_ISSUED_ITEMS } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { componentService } from "@/services/assets-service";

export type IssuedItemsStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  items?: WizardIssuedItemOption[];
  /** Refresh accessories after attaching a real asset as a component. */
  onRefreshItems?: () => Promise<void> | void;
};

export function IssuedItemsStep({
  state,
  onChange,
  items = MOCK_ISSUED_ITEMS,
  onRefreshItems,
}: IssuedItemsStepProps) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachQ, setAttachQ] = useState("");
  const [attachable, setAttachable] = useState<
    Array<{
      id: string;
      asset_code: string;
      asset_name: string;
      serial_number?: string | null;
    }>
  >([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachOpen || !state.assetId) {
      setAttachable([]);
      return;
    }
    let cancelled = false;
    void componentService
      .listAttachableAssets({
        parent_asset_id: state.assetId,
        q: attachQ.trim() || undefined,
        limit: 40,
      })
      .then((list) => {
        if (!cancelled) setAttachable(list);
      })
      .catch(() => {
        if (!cancelled) setAttachable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [attachOpen, state.assetId, attachQ]);

  function toggle(id: string, disabled?: boolean) {
    if (disabled) return;
    const set = new Set(state.issuedItemIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ issuedItemIds: [...set] });
  }

  async function attachAsset() {
    if (!state.assetId || !selectedChild) return;
    setAttaching(true);
    setAttachError(null);
    try {
      const created = await componentService.install({
        asset_id: state.assetId,
        component_asset_id: selectedChild,
        component_type: "OTHER",
      });
      await onRefreshItems?.();
      const set = new Set(state.issuedItemIds);
      set.add(created.id);
      onChange({ issuedItemIds: [...set] });
      setAttachOpen(false);
      setSelectedChild("");
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to attach asset");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="grid max-w-lg gap-3">
      <p className="text-sm text-muted-foreground">
        Select accessories you are issuing with this assignment. Optionally attach a registered
        eligible asset as a component.
      </p>
      {state.assetId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit cursor-pointer"
          onClick={() => setAttachOpen((v) => !v)}
        >
          {attachOpen ? "Hide attach asset" : "Attach asset as component"}
        </Button>
      ) : null}
      {attachOpen ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            value={attachQ}
            onChange={(e) => setAttachQ(e.target.value)}
            placeholder="Search eligible Ready to Move assets…"
            className="h-9"
          />
          {attachError ? <p className="text-xs text-destructive">{attachError}</p> : null}
          <ul className="m-0 max-h-40 list-none space-y-1 overflow-y-auto p-0">
            {attachable.length === 0 ? (
              <li className="text-xs text-muted-foreground">No eligible assets.</li>
            ) : (
              attachable.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1 cursor-pointer"
                      checked={selectedChild === a.id}
                      onChange={() => setSelectedChild(a.id)}
                    />
                    <span>
                      <span className="font-medium">
                        {a.asset_code} · {a.asset_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        S/N: {a.serial_number?.trim() || "—"}
                      </span>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={!selectedChild || attaching}
            onClick={() => void attachAsset()}
          >
            {attaching ? "Attaching…" : "Attach & select"}
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="No registered accessories"
          description="Register components on the asset record first, or attach an eligible asset above."
          compact
        />
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {items.map((item) => {
            const checked = state.issuedItemIds.includes(item.id);
            const disabled = Boolean(item.disabled);
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors duration-200",
                    disabled && "cursor-not-allowed opacity-60",
                    checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(item.id, disabled)}
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{item.label}</span>
                    {item.componentName ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.componentName}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      S/N: {item.serialNumber?.trim() || "—"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {disabled ? "Currently issued" : `Status: ${item.status}`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
