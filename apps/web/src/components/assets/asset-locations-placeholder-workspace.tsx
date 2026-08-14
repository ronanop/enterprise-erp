"use client";

import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Temporary shell for Configuration → Locations until Asset Location Master (R1). */
export function AssetLocationsPlaceholderWorkspace() {
  return (
    <div className="space-y-6" data-testid="asset-locations-placeholder">
      <PageHeader
        title="Locations"
        description="Asset Location Master — city and building sites used by registration, inventory, transfers, and reports."
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <MapPin className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">Asset Location Master</CardTitle>
            <CardDescription className="mt-1 leading-relaxed">
              Location management is owned by the Asset module. This workspace will list cities,
              buildings, codes, branch references, and Head Office flags once Phase R1 is
              implemented.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Organization locations remain available under Organization for org-wide master data.
            Asset workflows will use the Asset Location Master only — not Organization{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/locations</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
