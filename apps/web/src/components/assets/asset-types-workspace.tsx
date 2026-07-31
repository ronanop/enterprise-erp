"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_PRD_TYPES } from "@/config/asset-prd-types";

export function AssetTypesWorkspace() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Types"
        description="PRD type catalog (UI-only until a dedicated API is available). Forms use the backend asset_type enum."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured types</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Type name</th>
                <th className="pb-2 pr-4 font-medium">Category code</th>
                <th className="pb-2 pr-4 font-medium">API asset_type</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_PRD_TYPES.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{t.typeName}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="secondary">{t.categoryCode}</Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{t.apiAssetType}</td>
                  <td className="py-2 text-muted-foreground">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
