"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AssetSettingsWorkspace() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Asset Management module preferences and governance notes."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Assignment and maintenance approvals are controlled by server environment flags
            (see <code className="text-xs">ASSET_WORKFLOW_GOVERNANCE_ENABLED</code> in API
            deployment guides).
          </p>
          <p>
            RBAC permissions follow the <code className="text-xs">asset.*</code> catalog. Run{" "}
            <code className="text-xs">python -m scripts.seed_all_permissions</code> locally if
            dashboard lists return 403.
          </p>
          <p>
            <Link href="/foundation/settings" className="text-primary underline-offset-4 hover:underline">
              Foundation settings
            </Link>{" "}
            for tenant-wide configuration.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IT discovery categories</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Technical details and discovery apply when category codes start with IT or names
          include &quot;hardware&quot; / &quot;computer&quot;.
        </CardContent>
      </Card>
    </div>
  );
}
