"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  Shield,
  UserRound,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import {
  type AssetInformationPortal,
  assetInformationPortalService,
  buildSelfServiceUrl,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";
import { escapeHtml, openPrintDocument } from "@/lib/html";

function dash(value?: string | null): string {
  return value && String(value).trim() ? String(value) : "—";
}

type Props = {
  assetId: string;
};

export function AssetInformationPortalView({ assetId }: Props) {
  const router = useRouter();
  const [portal, setPortal] = useState<AssetInformationPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrCanvasId = `asset-qr-${assetId}`;

  const selfServiceUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return portal?.self_service_path ?? `/assets/self-service/${assetId}`;
    }
    return buildSelfServiceUrl(assetId);
  }, [assetId, portal?.self_service_path]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setError("Sign in required.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await assetInformationPortalService.getPortal(assetId);
      setPortal(data);
    } catch (err) {
      setPortal(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load asset portal");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  function getQrCanvas(): HTMLCanvasElement | null {
    return document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
  }

  function downloadQr() {
    const canvas = getQrCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${portal?.asset_code ?? "asset"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printQr() {
    const canvas = getQrCanvas();
    if (!canvas || !portal) return;
    const dataUrl = canvas.toDataURL("image/png");
    const html = `<!doctype html><html><head><title>QR ${escapeHtml(portal.asset_code)}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#111}
        img{width:240px;height:240px}
        h1{font-size:18px;margin:12px 0 4px}
        p{font-size:12px;color:#444;word-break:break-all}
      </style></head><body>
      <h1>${escapeHtml(portal.asset_code)}</h1>
      <div>${escapeHtml(portal.asset_name)}</div>
      <img src="${dataUrl}" alt="QR" />
      <p>${escapeHtml(selfServiceUrl)}</p>
      </body></html>`;
    openPrintDocument(html, 480, 640);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading asset information portal…
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
          Back to assets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Information Portal"
        description={`${portal.asset_code} — read-only overview, custody, protection, and QR self-service.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => router.push("/assets/assets")}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Register
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Asset code" value={portal.asset_code} mono />
              <Field label="Status" value={portal.status} badge />
              <Field label="Asset name" value={portal.asset_name} />
              <Field label="Type" value={portal.asset_type} />
              <Field
                label="Category"
                value={
                  portal.category_code
                    ? `${portal.category_code} — ${portal.category_name ?? ""}`
                    : portal.category_name
                }
              />
              <Field label="Serial number" value={portal.serial_number} mono />
              <Field label="Manufacturer" value={portal.manufacturer} />
              <Field label="Model" value={portal.model} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" aria-hidden />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              {portal.assignment ? (
                <>
                  <Field label="Document" value={portal.assignment.document_number} mono />
                  <Field label="Status" value={portal.assignment.status} badge />
                  <Field label="Allocation" value={portal.assignment.allocation_type} />
                  <Field label="Assignee" value={portal.assignment.assignee_label} />
                </>
              ) : (
                <p className="text-muted-foreground sm:col-span-2">No active assignment.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="size-4" aria-hidden />
                  Warranty
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {portal.warranty ? (
                  <>
                    <Field label="Type" value={portal.warranty.warranty_type} />
                    <Field label="Status" value={portal.warranty.status} badge />
                    <Field label="Start" value={portal.warranty.start_date} />
                    <Field label="End" value={portal.warranty.end_date} />
                  </>
                ) : (
                  <p className="text-muted-foreground">No open warranty.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Insurance</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {portal.insurance ? (
                  <>
                    <Field label="Policy" value={portal.insurance.policy_number} mono />
                    <Field label="Insurer" value={portal.insurance.insurer_name} />
                    <Field label="Status" value={portal.insurance.status} badge />
                    <Field label="End" value={portal.insurance.end_date} />
                  </>
                ) : (
                  <p className="text-muted-foreground">No open insurance policy.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <AssetDiscoveryPanel
            assetId={assetId}
            assetVersion={portal.version ?? 1}
            currentProfile={portal.discovery_profile_json}
            onApplied={() => void load()}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4" aria-hidden />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-md border bg-white p-4">
                <QRCodeCanvas
                  id={qrCanvasId}
                  value={selfServiceUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="break-all text-xs text-muted-foreground">{selfServiceUrl}</p>
              <p className="text-xs text-muted-foreground">
                QR is generated in the browser only — never stored on the server.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={downloadQr}
                >
                  <Download className="size-4" aria-hidden />
                  Download QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={printQr}
                >
                  <Printer className="size-4" aria-hidden />
                  Print QR
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => router.push(portal.self_service_path)}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Open Self-Service
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  badge?: boolean;
}) {
  const display = dash(value);
  return (
    <div>
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
