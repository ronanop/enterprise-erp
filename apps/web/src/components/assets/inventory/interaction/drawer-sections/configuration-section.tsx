import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type ConfigurationSectionProps = {
  configuration: string;
  className?: string;
};

export function ConfigurationSection({ configuration, className }: ConfigurationSectionProps) {
  const empty = !configuration || configuration === "—";

  return (
    <section aria-labelledby="drawer-config-heading" className={cn("space-y-3", className)}>
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
        <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90">
          {configuration}
        </p>
      )}
    </section>
  );
}
