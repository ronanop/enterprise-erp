"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { NonItAssignDialog } from "@/components/assets/non-it/non-it-assign-dialog";
import { NonItDisposeDialog } from "@/components/assets/non-it/non-it-dispose-dialog";
import { NonItMaintenanceCompleteDialog } from "@/components/assets/non-it/non-it-maintenance-complete-dialog";
import { NonItMaintenanceStartDialog } from "@/components/assets/non-it/non-it-maintenance-start-dialog";
import { EmptyState, StatusBadge } from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError } from "@/services/api-client";
import {
  buildNonItAssetDetailUrl,
  getNonItAsset,
  unassignNonItAsset,
  type NonItAsset,
} from "@/services/nonit-asset-service";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function NonItAssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = String(params.assetId ?? "");

  const [asset, setAsset] = useState<NonItAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [maintStartOpen, setMaintStartOpen] = useState(false);
  const [maintDoneOpen, setMaintDoneOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      setAsset(await getNonItAsset(assetId, { include_timeline: true }));
    } catch (err) {
      setAsset(null);
      setError(formatApiError(err, "Failed to load asset"));
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const detailUrl = useMemo(
    () => (asset ? buildNonItAssetDetailUrl(asset.id) : ""),
    [asset],
  );
  const canvasId = asset ? `nonit-qr-${asset.id}` : "nonit-qr";

  function printLabel() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const w = window.open("");
    if (!w) return;
    w.document.write(`<img src="${canvas.toDataURL()}" />`);
    w.print();
    w.close();
  }

  async function onUnassign() {
    if (!asset) return;
    if (!window.confirm(`Unassign ${asset.asset_code}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await unassignNonItAsset(asset.id, { version: asset.version });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Unassign failed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading asset…</div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <EmptyState
          variant="no-results"
          title="Asset not found"
          description={error ?? "This Non-IT asset could not be loaded."}
        />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => router.push("/assets/non-it/inventory")}
          >
            Back to inventory
          </Button>
        </div>
      </div>
    );
  }

  const isDisposed = asset.status === "DISPOSED";
  const canAssign = !isDisposed && (asset.status === "IN_STOCK" || asset.status === "ASSIGNED");
  const canUnassign =
    !isDisposed &&
    (asset.status === "ASSIGNED" ||
      Boolean(asset.current_employee_id || asset.current_location_id));
  const canMaintStart =
    !isDisposed && (asset.status === "IN_STOCK" || asset.status === "ASSIGNED");
  const canMaintComplete = asset.status === "MAINTENANCE";
  const canDispose =
    !isDisposed &&
    (asset.status === "IN_STOCK" ||
      asset.status === "ASSIGNED" ||
      asset.status === "MAINTENANCE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground transition-colors duration-200"
          >
            <Link href="/assets/non-it/inventory">
              <ArrowLeft className="size-4" aria-hidden />
              Inventory
            </Link>
          </Button>
          <PageHeader
            title={asset.asset_code}
            description={asset.asset_type_name ?? "Non-IT asset"}
          />
          <StatusBadge kind="nonIt" status={asset.status} />
        </div>
        {!isDisposed ? (
          <div className="flex flex-wrap gap-2">
            {canAssign ? (
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => setAssignOpen(true)}
              >
                {asset.status === "ASSIGNED" ? "Reassign" : "Assign"}
              </Button>
            ) : null}
            {canUnassign ? (
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void onUnassign()}
              >
                Unassign
              </Button>
            ) : null}
            {canMaintStart ? (
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => setMaintStartOpen(true)}
              >
                Send to maintenance
              </Button>
            ) : null}
            {canMaintComplete ? (
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => setMaintDoneOpen(true)}
              >
                Complete maintenance
              </Button>
            ) : null}
            {canDispose ? (
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => setDisposeOpen(true)}
              >
                Dispose
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Disposed — read only</p>
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium tracking-tight">Basic info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Type">{asset.asset_type_name ?? "—"}</DetailField>
              <DetailField label="Serial number">{asset.serial_number ?? "—"}</DetailField>
              <DetailField label="Condition">{asset.condition ?? "—"}</DetailField>
              <DetailField label="Purchase date">{formatDate(asset.purchase_date)}</DetailField>
              <DetailField label="Remarks">{asset.remarks ?? "—"}</DetailField>
              {asset.status === "MAINTENANCE" ? (
                <>
                  <DetailField label="Maintenance reason">
                    {asset.maintenance_reason ?? "—"}
                  </DetailField>
                  <DetailField label="Provider">{asset.maintenance_provider ?? "—"}</DetailField>
                </>
              ) : null}
              {isDisposed ? (
                <>
                  <DetailField label="Disposal reason">
                    {asset.disposal_reason ?? "—"}
                  </DetailField>
                  <DetailField label="Disposal date">
                    {formatDate(asset.disposal_date)}
                  </DetailField>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium tracking-tight">QR label</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <QRCodeCanvas id={canvasId} value={detailUrl} size={160} includeMargin />
            <p className="break-all text-center font-mono text-[10px] text-muted-foreground">
              {detailUrl}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 transition-colors duration-200"
              onClick={printLabel}
            >
              <Printer className="size-4" aria-hidden />
              Print label
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium tracking-tight">
            Current assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asset.assignment_display ? (
            <p className="text-sm">
              {asset.current_employee_name
                ? `Employee: ${asset.current_employee_name}`
                : `Location: ${asset.current_location_name}`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not assigned</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium tracking-tight">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {(asset.timeline?.length ?? 0) === 0 ? (
            <EmptyState
              variant="no-queue"
              title="No events yet"
              description="Assignment and lifecycle events will appear here."
              compact
            />
          ) : (
            <ol className="space-y-4">
              {asset.timeline!.map((ev) => (
                <li key={ev.id} className="border-l-2 border-border pl-3 text-sm">
                  <p className="font-medium">{ev.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(ev.occurred_at)}
                    {ev.remarks ? ` · ${ev.remarks}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {!isDisposed && assignOpen ? (
        <NonItAssignDialog
          open={assignOpen}
          asset={asset}
          onOpenChange={setAssignOpen}
          onDone={() => {
            void load();
          }}
        />
      ) : null}
      {maintStartOpen ? (
        <NonItMaintenanceStartDialog
          open={maintStartOpen}
          asset={asset}
          onOpenChange={setMaintStartOpen}
          onDone={() => void load()}
        />
      ) : null}
      {maintDoneOpen ? (
        <NonItMaintenanceCompleteDialog
          open={maintDoneOpen}
          asset={asset}
          onOpenChange={setMaintDoneOpen}
          onDone={() => void load()}
        />
      ) : null}
      {disposeOpen ? (
        <NonItDisposeDialog
          open={disposeOpen}
          asset={asset}
          onOpenChange={setDisposeOpen}
          onDone={() => void load()}
        />
      ) : null}
    </div>
  );
}
