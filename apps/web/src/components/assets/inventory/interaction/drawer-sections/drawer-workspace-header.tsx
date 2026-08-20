"use client";

import type { ReactNode } from "react";
import { Monitor, Package } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { StatusBadge } from "@/components/assets/shared";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import { cn } from "@/lib/utils";

export type DrawerWorkspaceHeaderProps = {
  data: AssetDetailDrawerData;
  className?: string;
};

/** Compact Code128-style bars from asset tag (presentational only). */
function AssetBarcodeMark({ value }: { value: string }) {
  const bars = Array.from(value).flatMap((ch, i) => {
    const code = ch.charCodeAt(0);
    return [((code + i) % 3) + 1, 1];
  });

  const nodes: ReactNode[] = [];
  let x = 4;
  bars.forEach((width, idx) => {
    if (idx % 2 === 0) {
      nodes.push(<rect key={idx} x={x} y={0} width={width} height={28} fill="currentColor" />);
    }
    x += width;
  });

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1.5"
      data-testid="drawer-barcode"
    >
      <svg
        role="img"
        aria-label={`Barcode for ${value}`}
        width={96}
        height={36}
        className="text-foreground"
      >
        {nodes}
      </svg>
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{value}</span>
    </div>
  );
}

export function DrawerWorkspaceHeader({ data, className }: DrawerWorkspaceHeaderProps) {
  return (
    <div
      className={cn("space-y-3 border-b border-border/60 px-4 pb-4 pt-2 md:pt-4", className)}
      data-testid="drawer-workspace-header"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40"
          data-testid="drawer-asset-image"
          aria-label="Asset image placeholder"
        >
          <Package className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-xs text-muted-foreground" data-testid="drawer-header-asset-tag">
            {data.assetTag}
          </p>
          <h2
            id="asset-detail-drawer-title"
            className="truncate text-lg font-medium tracking-tight text-foreground"
          >
            {data.laptopName}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Monitor className="size-3.5 shrink-0" aria-hidden />
            <span>
              {data.manufacturer} · {data.model}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {isOperationalStatus(data.operationalStatus) ? (
              <StatusBadge kind="operational" status={data.operationalStatus} />
            ) : (
              <span className="text-xs">{data.operationalStatus}</span>
            )}
            <StatusBadge kind="lifecycle" status={data.lifecycleStatus} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <div
            className="rounded-md border border-border/60 bg-background p-1.5"
            data-testid="drawer-qr-code"
          >
            <QRCodeCanvas value={data.qrValue || data.assetTag} size={72} includeMargin />
          </div>
          <AssetBarcodeMark value={data.assetTag} />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Current holder</dt>
          <dd className="mt-0.5">{data.currentHolder}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Department</dt>
          <dd className="mt-0.5">{data.department}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Branch</dt>
          <dd className="mt-0.5">{data.branch}</dd>
        </div>
      </dl>
    </div>
  );
}
