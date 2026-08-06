import type { InventoryQuickLinkId } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_LINK_LABELS: Record<InventoryQuickLinkId, string> = {
  portal: "Portal",
  discovery: "Discovery",
  qr: "QR",
  history: "History",
};

export type QuickLinksSectionProps = {
  /** Which quick links to show (interaction layer only — no navigation handlers). */
  enabledLinks?: Partial<Record<InventoryQuickLinkId, boolean>>;
  onQuickLinkPress?: (id: InventoryQuickLinkId) => void;
  className?: string;
};

const LINK_ORDER: InventoryQuickLinkId[] = ["portal", "discovery", "qr", "history"];

export function QuickLinksSection({
  enabledLinks = { portal: true, discovery: true, qr: true, history: true },
  onQuickLinkPress,
  className,
}: QuickLinksSectionProps) {
  const visible = LINK_ORDER.filter((id) => enabledLinks[id] !== false);

  return (
    <section aria-labelledby="drawer-quick-links-heading" className={cn("space-y-3", className)}>
      <h3 id="drawer-quick-links-heading" className="text-sm font-medium tracking-tight text-foreground">
        Quick links
      </h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          No quick links available for your role.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((id) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!onQuickLinkPress}
              onClick={() => onQuickLinkPress?.(id)}
            >
              {QUICK_LINK_LABELS[id]}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
