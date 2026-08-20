import type { AssetDetailDrawerConfigParts } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type ConfigurationSectionProps = {
  configuration: string;
  parts?: AssetDetailDrawerConfigParts;
  className?: string;
};

export function ConfigurationSection({
  configuration,
  parts,
  className,
}: ConfigurationSectionProps) {
  const empty = !configuration || configuration === "—";
  const fields = parts ?? {
    cpu: "—",
    ram: "—",
    storage: "—",
    os: "—",
    accessories: "—",
  };

  return (
    <section
      aria-labelledby="drawer-config-heading"
      className={cn("space-y-3", className)}
      data-testid="drawer-configuration-section"
    >
      <h3 id="drawer-config-heading" className="text-sm font-medium tracking-tight text-foreground">
        Configuration
      </h3>
      {empty ? (
        <EmptyState
          variant="no-results"
          compact
          title="No configuration on file"
          description="Discovery or manual specs will show here when available."
        />
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">CPU</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-config-cpu">
              {fields.cpu}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">RAM</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-config-ram">
              {fields.ram}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Storage</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-config-storage">
              {fields.storage}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">OS</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-config-os">
              {fields.os}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Accessories</dt>
            <dd className="mt-0.5 text-sm" data-testid="drawer-config-accessories">
              {fields.accessories}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Raw summary</dt>
            <dd className="mt-0.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90">
              {configuration}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
