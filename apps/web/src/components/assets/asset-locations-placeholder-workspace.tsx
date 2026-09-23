"use client";

import { Building2, Layers, MapPin } from "lucide-react";

import {
  ASSETS_ICON_CHIP,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Temporary shell for Configuration → Locations until Asset Location Master (R1). */
export function AssetLocationsPlaceholderWorkspace() {
  return (
    <AssetsPremiumPage testId="asset-locations-placeholder">
      <PageHeader
        title="Locations"
        description="Asset Location Master — city and building sites used by registration, inventory, transfers, and reports."
      />

      <Card className={ASSETS_SURFACE_CARD}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border/50 pb-4 pt-5">
          <div className={ASSETS_ICON_CHIP}>
            <MapPin className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight">
              Asset Location Master
            </CardTitle>
            <CardDescription className="mt-1 leading-relaxed">
              Location management is owned by the Asset module. This workspace will list cities,
              buildings, codes, branch references, and Head Office flags once Phase R1 is
              implemented.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Organization locations remain available under Organization for org-wide master data.
            Asset workflows will use the Asset Location Master only — not Organization{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/locations</code>.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Buildings & sites",
                hint: "Campus, tower, and annex masters",
              },
              {
                icon: Layers,
                title: "Floors & zones",
                hint: "Floor labels and wing codes",
              },
              {
                icon: MapPin,
                title: "Assignment targets",
                hint: "Used by inventory and transfers",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-3.5 py-3"
                >
                  <Icon className="mb-2 size-4 text-[#0369A1]" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AssetsPremiumPage>
  );
}
