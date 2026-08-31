"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import {
  type AssetInformationPortal,
  assetInformationPortalService,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

type Props = {
  assetId: string;
};

export function AssetSelfServiceView({ assetId }: Props) {
  const router = useRouter();
  const [portal, setPortal] = useState<AssetInformationPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setError("Sign in required to view asset self-service.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await assetInformationPortalService.getSelfService(assetId);
      setPortal(data);
    } catch (err) {
      setPortal(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load self-service profile");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading self-service…
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error ?? "Asset not found"}
        </p>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push("/assets/assets")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Asset Self-Service"
        description="Authenticated read-only asset profile. Financial and workflow details are hidden."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => router.push(`/assets/information-portal/${assetId}`)}
          >
            Full portal
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{portal.asset_name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Asset code" value={portal.asset_code} mono />
          <Row label="Status" value={portal.status} badge />
          <Row
            label="Category"
            value={
              portal.category_code
                ? `${portal.category_code} — ${portal.category_name ?? ""}`
                : portal.category_name
            }
          />
          <Row label="Manufacturer" value={portal.manufacturer} />
          <Row label="Model" value={portal.model} />
          <Row label="Serial number" value={portal.serial_number} mono />
          <Row
            label="Assignment"
            value={
              portal.assignment
                ? `${portal.assignment.assignee_label ?? portal.assignment.allocation_type ?? "—"} (${portal.assignment.status})`
                : null
            }
          />
          <Row
            label="Warranty"
            value={
              portal.warranty
                ? `${portal.warranty.warranty_type ?? "—"} · ${portal.warranty.status ?? ""} · ends ${portal.warranty.end_date ?? "—"}`
                : null
            }
          />
          <Row
            label="Insurance"
            value={
              portal.insurance
                ? `${portal.insurance.insurer_name ?? "—"} · ${portal.insurance.policy_number ?? ""} · ${portal.insurance.status ?? ""}`
                : null
            }
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  badge,
  className,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  badge?: boolean;
  className?: string;
}) {
  const display = dash(value);
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {badge && display !== "—" ? (
        <Badge variant="secondary" className="mt-1 font-mono text-xs">
          {display}
        </Badge>
      ) : (
        <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{display}</div>
      )}
    </div>
  );
}
