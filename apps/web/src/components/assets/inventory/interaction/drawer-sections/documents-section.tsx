"use client";

import { QrCode, Barcode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import type { AssetDetailDrawerData } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DocumentsSectionProps = {
  data: AssetDetailDrawerData;
  onOpenQr?: () => void;
  className?: string;
};

export function DocumentsSection({ data, onOpenQr, className }: DocumentsSectionProps) {
  return (
    <section
      aria-labelledby="drawer-documents-heading"
      className={cn("space-y-4", className)}
      data-testid="drawer-documents-section"
    >
      <h3 id="drawer-documents-heading" className="text-sm font-medium tracking-tight text-foreground">
        Documents
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 p-3" data-testid="drawer-documents-qr">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <QrCode className="size-3.5" aria-hidden />
            QR
          </div>
          <QRCodeCanvas value={data.qrValue || data.assetTag} size={96} includeMargin />
          {onOpenQr ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 cursor-pointer"
              onClick={onOpenQr}
            >
              Open QR workspace
            </Button>
          ) : null}
        </div>

        <div className="rounded-md border border-border/70 p-3" data-testid="drawer-documents-barcode">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Barcode className="size-3.5" aria-hidden />
            Barcode
          </div>
          <p className="font-mono text-sm tracking-widest">{data.assetTag}</p>
          <p className="mt-1 text-xs text-muted-foreground">Uses asset tag encoding</p>
          {onOpenQr ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 cursor-pointer"
              onClick={onOpenQr}
            >
              Print barcode
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
