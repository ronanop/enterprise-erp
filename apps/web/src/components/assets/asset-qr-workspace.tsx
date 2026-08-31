"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Printer, QrCode, Search } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAuthenticated } from "@/lib/auth";
import {
  assetRegisterService,
  buildSelfServiceUrl,
  type AssetsRow,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

export function AssetQrWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get("assetId") ?? "";
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState<AssetsRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAsset = useCallback(async (id: string) => {
    if (!id.trim() || !isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      setAsset(await assetRegisterService.get(id.trim()));
    } catch (err) {
      setAsset(null);
      setError(err instanceof ApiClientError ? err.message : "Asset not found");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialId) void loadAsset(initialId);
  }, [initialId, loadAsset]);

  const selfUrl = useMemo(() => {
    if (!asset?.id) return "";
    return buildSelfServiceUrl(String(asset.id));
  }, [asset?.id]);

  const canvasId = asset ? `qr-${asset.id}` : "qr-preview";

  function printLabel() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const w = window.open("");
    if (!w) return;
    w.document.write(`<img src="${canvas.toDataURL()}" />`);
    w.print();
    w.close();
  }

  async function searchByCode() {
    const res = await assetRegisterService.search({ q: query.trim(), page_size: 5 });
    const hit = res.items[0];
    if (!hit?.id) {
      setError("No asset matched that search.");
      return;
    }
    router.replace(`/assets/qr-barcode?assetId=${hit.id}`);
    void loadAsset(String(hit.id));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="QR / Barcode"
        description="Generate labels, print, and open asset details from a scan target URL."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find asset</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="qr-search">Asset code or name</Label>
            <Input
              id="qr-search"
              className="mt-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search register"
            />
          </div>
          <Button onClick={() => void searchByCode()} className="cursor-pointer">
            <Search className="mr-1 size-4" />
            Search
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      ) : asset ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{String(asset.asset_name)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <QRCodeCanvas id={canvasId} value={selfUrl} size={180} includeMargin />
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                {selfUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={printLabel} className="cursor-pointer">
                  <Printer className="mr-1 size-4" />
                  Print label
                </Button>
                <Button variant="outline" size="sm" asChild className="cursor-pointer">
                  <Link href={`/assets/assets/${asset.id}`}>
                    <QrCode className="mr-1 size-4" />
                    Open details
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="cursor-pointer">
                  <Link href={`/assets/information-portal/${asset.id}`}>Information portal</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
