"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, Trash2, UserPlus, Wrench } from "lucide-react";

import { openMaintenanceForAsset } from "@/components/assets/asset-maintenance-workspace";

import { AssetDiscoveryPanel } from "@/components/assets/asset-discovery-panel";
import { StartDisposalConfirmDialog } from "@/components/assets/start-disposal-confirm-dialog";
import { ReinstateConfirmDialog } from "@/components/assets/reinstate-confirm-dialog";
import { buildReturnWizardHref } from "@/components/assets/navigation/assignment-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StatusBadge,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import {
  canReinstateFromOperationalStatus,
  canStartDisposalFromOperationalStatus,
  isOpsBlockedForNormalOperations,
  isOpsBlockedForTransferOrMaintenance,
  isOperationalStatus,
  operationalStatusHelpText,
} from "@/components/assets/shared/asset-status";
import {
  buildRecentActivity,
  isActiveAssignment,
  isItAssetCategory,
  mapAssetToPrdStatus,
  parseDiscoveryProfile,
  prdStatusLabel,
} from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import {
  employeeDirectoryById,
  listBranchOptions,
  listEmployeeDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { resolveItRegistrationFields } from "@/components/assets/inventory.mapper";
import {
  buildRegisterParityExpandable,
  deriveEarlierUsedBy,
  formatDeliveryReferenceStatus,
  formatIssuedDate,
  mapAssignmentHistoryEntries,
  pickRegisterAssignment,
  resolveAssigneeLabel,
  resolveEmployeeCode,
  resolveEmployeeMobile,
  type EmployeeLookup,
} from "@/components/assets/inventory/register-parity";
import {
  assetRegisterService,
  assetLocationService,
  componentService,
  componentTypeLabel,
  type AssetsRow,
  type ComponentRow,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type Tab = "overview" | "assignments" | "maintenance" | "documents" | "activity";

function displayText(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "—";
}

export function AssetDetailWorkspace({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [asset, setAsset] = useState<AssetsRow | null>(null);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [maintenances, setMaintenances] = useState<AssetsRow[]>([]);
  const [documents, setDocuments] = useState<AssetsRow[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDisposalOpen, setStartDisposalOpen] = useState(false);
  const [startDisposalSubmitting, setStartDisposalSubmitting] = useState(false);
  const [startDisposalError, setStartDisposalError] = useState<string | null>(null);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateSubmitting, setReinstateSubmitting] = useState(false);
  const [reinstateError, setReinstateError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookup>({});
  const [currentLocationLabel, setCurrentLocationLabel] = useState<string | null>(null);
  const [branchLabel, setBranchLabel] = useState<string>("—");
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const row = await assetRegisterService.get(assetId);
      setAsset(row);
      const [asnRes, maintRes, docRes, empDir, locRes, componentRes, branches] = await Promise.all([
        resourceService.list(`/assets/asset-assignments?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-maintenances?asset_id=${assetId}&page_size=50`),
        resourceService.list(`/assets/asset-documents?asset_id=${assetId}&page_size=50`),
        listEmployeeDirectory().catch(() => [] as EmployeeDirectoryEntry[]),
        assetLocationService
          .search({ asset_id: assetId, is_current: true, page_size: 5 })
          .catch(() => ({ items: [], total: 0, page: 1, page_size: 5 })),
        componentService
          .search({ asset_id: assetId, status: "active", page: 1, page_size: 100 })
          .catch(() => ({ items: [] as ComponentRow[], total: 0, page: 1, page_size: 100 })),
        listBranchOptions().catch(() => []),
      ]);
      const pick = (data: unknown) => {
        if (data && typeof data === "object" && "items" in data) {
          return (data as { items: AssetsRow[] }).items ?? [];
        }
        return Array.isArray(data) ? data : [];
      };
      setAssignments(pick(asnRes.data));
      setMaintenances(pick(maintRes.data));
      setDocuments(pick(docRes.data));
      setComponents(componentRes.items ?? []);
      const byId = employeeDirectoryById(empDir);
      const lookup: EmployeeLookup = {};
      for (const [id, e] of Object.entries(byId)) {
        lookup[id] = {
          label: e.label,
          displayName: e.displayName,
          employeeCode: e.employeeCode,
          mobile: e.mobile,
        };
      }
      setEmployeeLookup(lookup);
      const currentLoc = locRes.items.find((l) => l.is_current) ?? locRes.items[0];
      setCurrentLocationLabel(currentLoc?.location_label ?? null);
      const branchId = String(row.branch_id ?? "");
      const branchMatch = branches.find((b) => b.id === branchId);
      setBranchLabel(branchMatch?.label ?? (branchId ? branchId.slice(0, 8) : "—"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load asset");
      setAsset(null);
      setCurrentLocationLabel(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prdStatus = useMemo(
    () => (asset ? mapAssetToPrdStatus(asset, assignments) : "available"),
    [asset, assignments],
  );

  const activeAssignment = useMemo(
    () =>
      assignments.find((a) => {
        const s = String(a.status ?? "").toLowerCase();
        return s === "active" || s === "approved";
      }),
    [assignments],
  );

  async function confirmStartDisposal() {
    setStartDisposalSubmitting(true);
    setStartDisposalError(null);
    try {
      const updated = await assetRegisterService.startDisposal(assetId);
      setAsset(updated);
      setStartDisposalOpen(false);
    } catch (err) {
      setStartDisposalError(
        err instanceof ApiClientError ? err.message : "Could not start disposal",
      );
    } finally {
      setStartDisposalSubmitting(false);
    }
  }

  async function confirmReinstate() {
    setReinstateSubmitting(true);
    setReinstateError(null);
    try {
      const updated = await assetRegisterService.reinstate(assetId);
      setAsset(updated);
      setReinstateOpen(false);
      setActionSuccess("Asset reinstated and is Ready to Move.");
    } catch (err) {
      setReinstateError(
        err instanceof ApiClientError ? err.message : "Could not reinstate asset",
      );
    } finally {
      setReinstateSubmitting(false);
    }
  }

  const activity = useMemo(
    () =>
      buildRecentActivity(
        asset ? [asset] : [],
        assignments,
        maintenances,
        12,
      ),
    [asset, assignments, maintenances],
  );

  const registerParity = useMemo(() => {
    const expandable = buildRegisterParityExpandable(assignments, employeeLookup);
    const active = assignments.find((a) => isActiveAssignment(a));
    const current = pickRegisterAssignment(assignments);
    const employeeId = active?.employee_id ? String(active.employee_id) : null;
    return {
      expandable,
      currentHolder: active
        ? resolveAssigneeLabel(active, employeeLookup)
        : "—",
      employeeId: resolveEmployeeCode(employeeId, employeeLookup),
      phone: resolveEmployeeMobile(employeeId, employeeLookup),
      issuedDate: formatIssuedDate(
        typeof active?.allocated_at === "string" ? active.allocated_at : null,
      ),
      earlierUsedBy: deriveEarlierUsedBy(assignments, employeeLookup),
      deliveryStatus: formatDeliveryReferenceStatus(current?.delivery_reference_status as string),
      history: mapAssignmentHistoryEntries(assignments, employeeLookup),
    };
  }, [assignments, employeeLookup]);

  const itRegistration = useMemo(
    () => (asset ? resolveItRegistrationFields(asset) : { make: "—", model: "—", configuration: "—" }),
    [asset],
  );

  const profile = asset ? parseDiscoveryProfile(asset) : null;
  const showIt = isItAssetCategory(
    asset?.category_code as string | undefined,
    asset?.category_name as string | undefined,
  );
  const opsStatus = String(asset?.operational_status ?? "");
  const opsBlocked = isOpsBlockedForNormalOperations(opsStatus);
  const transferMaintBlocked = isOpsBlockedForTransferOrMaintenance(opsStatus);
  const showStartDisposal = canStartDisposalFromOperationalStatus(opsStatus);
  const showReinstate = canReinstateFromOperationalStatus(opsStatus);
  const opsHelp = operationalStatusHelpText(opsStatus);
  const returnHref = buildReturnWizardHref({ assetId, intent: "return" });

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <p className="text-destructive" role="alert">
        {error ?? "Asset not found"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={String(asset.asset_name ?? "Asset")}
        description={`${asset.asset_code ?? ""} · ${prdStatusLabel(prdStatus)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {!opsBlocked && opsStatus.toUpperCase() === "READY_TO_MOVE" ? (
              <Button variant="outline" size="sm" asChild className="cursor-pointer">
                <Link href={`/assets/asset-assignments/new?assetId=${assetId}`}>
                  <UserPlus className="mr-1 size-4" />
                  Assign
                </Link>
              </Button>
            ) : null}
            {activeAssignment ? (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="cursor-pointer"
                data-testid="asset-detail-return"
              >
                <Link href={returnHref}>Return</Link>
              </Button>
            ) : opsStatus.toUpperCase() === "ASSIGNED" ? (
              <p
                className="self-center text-xs text-muted-foreground"
                data-testid="asset-detail-no-assignment"
              >
                No active assignment to return.
              </p>
            ) : null}
            {!transferMaintBlocked ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={maintenanceSubmitting}
                onClick={() => {
                  setMaintenanceSubmitting(true);
                  void openMaintenanceForAsset(assetId, (href) => router.push(href)).finally(
                    () => setMaintenanceSubmitting(false),
                  );
                }}
              >
                <Wrench className="mr-1 size-4" />
                Maintenance
              </Button>
            ) : null}
            {showStartDisposal ? (
              <Button
                variant="default"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                data-testid="asset-detail-start-disposal"
                onClick={() => {
                  setStartDisposalError(null);
                  setStartDisposalOpen(true);
                }}
              >
                <Trash2 className="mr-1 size-4" aria-hidden />
                Start Disposal
              </Button>
            ) : null}
            {showReinstate ? (
              <Button
                variant="default"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                data-testid="asset-detail-reinstate"
                onClick={() => {
                  setReinstateError(null);
                  setActionSuccess(null);
                  setReinstateOpen(true);
                }}
              >
                Reinstate
              </Button>
            ) : null}
            {opsStatus.toUpperCase() === "PENDING_DISPOSAL" ? (
              <Button variant="outline" size="sm" asChild className="cursor-pointer">
                <Link href={`/assets/asset-disposals?assetId=${assetId}`}>
                  Open Disposal
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href={`/assets/qr-barcode?assetId=${assetId}`}>
                <QrCode className="mr-1 size-4" />
                QR
              </Link>
            </Button>
          </div>
        }
      />

      {actionSuccess ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
          role="status"
          data-testid="asset-detail-action-success"
        >
          {actionSuccess}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border/70 pb-2">
        {(
          [
            ["overview", "Overview"],
            ["assignments", "Assignment history"],
            ["maintenance", "Maintenance history"],
            ["documents", "Documents"],
            ["activity", "Activity logs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
              tab === key
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card data-testid="asset-detail-header-summary">
            <CardHeader>
              <CardTitle className="text-base">Asset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Asset Code: </span>
                <span className="font-mono text-xs">{displayText(asset.asset_code)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Asset Name: </span>
                {displayText(asset.asset_name)}
              </p>
              <p>
                <span className="text-muted-foreground">S/N: </span>
                {displayText(asset.serial_number)}
              </p>
              <p>
                <span className="text-muted-foreground">Operational Status: </span>
                <span data-testid="asset-detail-operational-status">
                  {isOperationalStatus(String(asset.operational_status ?? "")) ? (
                    <StatusBadge
                      kind="operational"
                      status={String(asset.operational_status)}
                    />
                  ) : (
                    String(asset.operational_status ?? "—")
                  )}
                </span>
              </p>
              {opsHelp ? (
                <p className="text-xs text-muted-foreground" data-testid="asset-detail-ops-help">
                  {opsHelp}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Lifecycle Status: </span>
                <span data-testid="asset-detail-lifecycle-status">
                  <StatusBadge kind="lifecycle" status={String(asset.status ?? "—")} />
                </span>
              </p>
              {String(asset.status ?? "").toLowerCase() === "in_maintenance" ? (
                <p className="text-xs text-muted-foreground" data-testid="asset-detail-maintenance-note">
                  Lifecycle is In Maintenance. Operational Status may still show Assigned if custody
                  has not been returned.
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Type: </span>
                {asset.asset_type_name
                  ? displayText(asset.asset_type_name)
                  : "Unclassified"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-it-information">
            <CardHeader>
              <CardTitle className="text-base">IT Registration Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Make: </span>
                <span data-testid="asset-detail-make">{itRegistration.make}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Model: </span>
                <span data-testid="asset-detail-model">{itRegistration.model}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Configuration: </span>
                <span data-testid="asset-detail-configuration">{itRegistration.configuration}</span>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-assignment">
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Current Assignee: </span>
                <span data-testid="asset-detail-current-assignee">{registerParity.currentHolder}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Employee ID: </span>
                <span data-testid="asset-detail-employee-id">{registerParity.employeeId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Phone: </span>
                <span data-testid="asset-detail-phone">{registerParity.phone}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Issued Date: </span>
                <span data-testid="asset-detail-issued-date">{registerParity.issuedDate}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Earlier Used By: </span>
                <span data-testid="asset-detail-earlier-used-by">{registerParity.earlierUsedBy}</span>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-location">
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Branch: </span>
                <span data-testid="asset-detail-branch">{branchLabel}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Current Location: </span>
                <span data-testid="asset-detail-current-location">
                  {currentLocationLabel?.trim() || "—"}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-components" className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                Accessories
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {components.length} Active
                </span>
              </CardTitle>
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <Link href="/assets/asset-components">Add Component</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {components.length === 0 ? (
                <p className="text-muted-foreground">No accessories assigned</p>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {components.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-md border border-border px-3 py-2 transition-colors duration-200"
                    >
                      <div className="font-medium">
                        {c.linked_asset_code
                          ? `${componentTypeLabel(c.component_type)} · ${c.linked_asset_code}`
                          : componentTypeLabel(c.component_type)}
                      </div>
                      <div className="text-muted-foreground">
                        {c.linked_asset_name || c.component_name}
                      </div>
                      {c.linked_asset_operational_status ? (
                        <div className="text-xs text-muted-foreground">
                          Ops: {c.linked_asset_operational_status}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        S/N: {c.serial_number?.trim() || "—"}
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-delivery-challan-block">
            <CardHeader>
              <CardTitle className="text-base">Delivery Challan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">DC Number: </span>
                <span data-testid="asset-detail-delivery-reference">
                  {registerParity.expandable.deliveryChallan}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                <span data-testid="asset-detail-dc-status">{registerParity.deliveryStatus}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Signature: </span>
                <span data-testid="asset-detail-delivery-challan">
                  {registerParity.expandable.deliverySignature}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="asset-detail-remarks">
            <CardHeader>
              <CardTitle className="text-base">Remarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Assignment remarks: </span>
                <span className="whitespace-pre-wrap" data-testid="asset-detail-assignment-remarks">
                  {registerParity.expandable.assignmentRemarks}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Return remarks: </span>
                <span className="whitespace-pre-wrap" data-testid="asset-detail-return-remarks">
                  {registerParity.expandable.returnRemarks}
                </span>
              </p>
            </CardContent>
          </Card>

          {showIt ? (
            <Card className="lg:col-span-2" data-testid="asset-detail-device-discovery">
              <CardHeader>
                <CardTitle className="text-base">Device Discovery Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3 text-xs">
                  Discovered hardware values are separate from IT registration Make / Model /
                  Configuration above.
                </p>
                {profile ? (
                  <ul className="space-y-1">
                    {profile.hostname ? <li>Hostname: {profile.hostname}</li> : null}
                    {profile.mac_address ? <li>MAC: {profile.mac_address}</li> : null}
                    {profile.os_name ? <li>OS: {profile.os_name}</li> : null}
                    {profile.manufacturer ? <li>Discovered manufacturer: {profile.manufacturer}</li> : null}
                    {profile.model ? <li>Discovered model: {profile.model}</li> : null}
                  </ul>
                ) : (
                  <p>No discovery profile yet.</p>
                )}
                <div className="mt-4">
                  <AssetDiscoveryPanel
                    assetId={assetId}
                    assetVersion={Number(asset.version ?? 1)}
                    currentProfile={
                      (asset.discovery_profile_json as Record<string, unknown> | null) ?? null
                    }
                    onApplied={() => void load()}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "assignments" ? (
        <AssignmentHistoryDetailList entries={registerParity.history} />
      ) : null}
      {tab === "maintenance" ? (
        <HistoryList
          rows={maintenances}
          columns={["document_number", "status", "maintenance_type", "scheduled_date"]}
        />
      ) : null}
      {tab === "documents" ? (
        <HistoryList
          rows={documents}
          columns={["document_name", "document_type", "status"]}
        />
      ) : null}
      {tab === "activity" ? (
        <Card>
          <CardContent className="divide-y pt-4">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="py-2 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.at}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
      <StartDisposalConfirmDialog
        open={startDisposalOpen}
        asset={{
          id: assetId,
          assetCode: String(asset.asset_code ?? ""),
          assetName: String(asset.asset_name ?? ""),
          serialNumber: String(asset.serial_number ?? ""),
          lifecycleStatus: String(asset.status ?? ""),
          operationalStatus: String(asset.operational_status ?? ""),
        }}
        submitting={startDisposalSubmitting}
        error={startDisposalError}
        onCancel={() => {
          if (startDisposalSubmitting) return;
          setStartDisposalOpen(false);
          setStartDisposalError(null);
        }}
        onConfirm={() => void confirmStartDisposal()}
      />
      <ReinstateConfirmDialog
        open={reinstateOpen}
        asset={{
          id: assetId,
          assetCode: String(asset.asset_code ?? ""),
          assetName: String(asset.asset_name ?? ""),
          serialNumber: String(asset.serial_number ?? ""),
          lifecycleStatus: String(asset.status ?? ""),
          operationalStatus: String(asset.operational_status ?? ""),
        }}
        submitting={reinstateSubmitting}
        error={reinstateError}
        onCancel={() => {
          if (reinstateSubmitting) return;
          setReinstateOpen(false);
          setReinstateError(null);
        }}
        onConfirm={() => void confirmReinstate()}
      />
    </div>
  );
}

function AssignmentHistoryDetailList({
  entries,
}: {
  entries: ReturnType<typeof mapAssignmentHistoryEntries>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="asset-detail-assignment-history">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Issued</th>
            <th className="px-3 py-2">Returned</th>
            <th className="px-3 py-2">Delivery</th>
            <th className="px-3 py-2">Assignment remarks</th>
            <th className="px-3 py-2">Return remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row, index) => (
            <tr key={row.id} className="border-t">
              <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.documentNumber}</td>
              <td className="px-3 py-2">{row.assigneeLabel}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.allocatedAt}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.returnedAt}</td>
              <td className="px-3 py-2">
                {row.deliveryChallanSummary ||
                  `${row.deliveryReferenceNumber}${
                    row.deliveryReferenceStatus !== "—"
                      ? ` (${row.deliveryReferenceStatus})`
                      : ""
                  }`}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2" title={row.assignmentRemarks}>
                {row.assignmentRemarks}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2" title={row.returnRemarks}>
                {row.returnRemarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryList({
  rows,
  columns,
}: {
  rows: AssetsRow[];
  columns: string[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className={tableSerialHeaderClassName()} scope="col">
              {TABLE_SERIAL_HEADER_LABEL}
            </th>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 capitalize">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id)} className="border-t">
              <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
              {columns.map((c) => (
                <td key={c} className="px-3 py-2">
                  {String(row[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
