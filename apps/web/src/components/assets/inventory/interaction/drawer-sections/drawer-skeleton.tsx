import { cn } from "@/lib/utils";

export function DrawerSectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn("h-3 animate-pulse rounded-md bg-muted", i === 0 ? "w-1/3" : "w-full")} />
      ))}
    </div>
  );
}

export function AssetDetailDrawerSkeleton() {
  return (
    <div className="space-y-6" data-testid="asset-detail-drawer-skeleton" aria-busy="true" aria-label="Loading asset details">
      <DrawerSectionSkeleton lines={4} />
      <DrawerSectionSkeleton lines={3} />
      <DrawerSectionSkeleton lines={2} />
      <DrawerSectionSkeleton lines={3} />
      <DrawerSectionSkeleton lines={4} />
    </div>
  );
}
