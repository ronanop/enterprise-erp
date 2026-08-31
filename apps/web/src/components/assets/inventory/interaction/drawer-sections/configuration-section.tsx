import { cn } from "@/lib/utils";

import { DrawerEmptyLine, DrawerSectionCard } from "./drawer-section";

export type ConfigurationSectionProps = {
  configuration: string;
  className?: string;
};

export function ConfigurationSection({ configuration, className }: ConfigurationSectionProps) {
  const empty = !configuration || configuration === "—";

  return (
    <DrawerSectionCard
      title="IT Information"
      headingId="drawer-config-heading"
      className={cn(className)}
    >
      {empty ? (
        <DrawerEmptyLine>No configuration on file</DrawerEmptyLine>
      ) : (
        <p className="text-sm font-medium break-words text-foreground">{configuration}</p>
      )}
    </DrawerSectionCard>
  );
}
