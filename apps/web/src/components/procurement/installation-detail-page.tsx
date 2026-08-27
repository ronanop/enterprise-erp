"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, FolderInput, MapPinned } from "lucide-react";

import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getPurchaseOrder,
  getScmOvfPreview,
} from "@/services/procurement-service";
import {
  advanceSiteInstallation,
  createProject,
  getProjectPoPrefill,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import { challanDeliveredQuantity } from "@/utils/delivery-challan-bill";
import { getDeliveryChallan } from "@/utils/delivery-challan-storage";
import {
  deliveryStatusRowFromChallan,
  isDeliveredShipmentStatus,
  isFailedShipmentStatus,
  shipmentStatusBadgeVariant,
} from "@/utils/delivery-status-storage";
import { installationListHref } from "@/utils/installation-routes";
import {
  emptyInstallationManual,
  firstInstallationError,
  markInstallationSharedToProject,
  resolveInstallation,
  upsertInstallation,
  validateInstallationManual,
  type InstallationManualFields,
} from "@/utils/installation-storage";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

type AutoFields = {
  deliveredDate: string;
  shipmentStatus: string;
  oemName: string;
  companyPoNumber: string;
  shipToAddress: string;
  quantity: number;
  customerName: string;
  customerPoNumber: string;
  customerPoDate: string;
  challanNumber: string;
  invoiceNumber: string;
  orderId: string | null;
  branchId: string | null;
};

export function InstallationDetailPage({ challanId }: { challanId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [auto, setAuto] = useState<AutoFields | null>(null);
  const [manual, setManual] = useState<InstallationManualFields>(emptyInstallationManual);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof InstallationManualFields, string>>
  >({});
  const [shared, setShared] = useState<{
    sharedToProject: boolean;
    projectHref: string | null;
  }>({ sharedToProject: false, projectHref: null });
  const [sharing, setSharing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [crmProjectTitle, setCrmProjectTitle] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setHydrated(false);
    setError(null);
    setBanner(null);
    setCrmProjectTitle("");
    try {
      const challan = getDeliveryChallan(challanId);
      if (!challan) {
        setAuto(null);
        setError("Delivery challan not found.");
        return;
      }
      const status = deliveryStatusRowFromChallan(challan);
      const delivered =
        isDeliveredShipmentStatus(status.shipmentStatus) ||
        Boolean(status.actualDeliveryDate?.trim());
      if (!delivered || !status.requiresInstallation) {
        setAuto(null);
        setError(
          "This challan is not in the installation queue. Mark it delivered and tick Requires installation on Delivery Status.",
        );
        return;
      }

      const install = resolveInstallation(challanId);
      let oemName = "";
      let crmProjectTitle = "";
      let customerPoDate = challan.poDate?.trim() || "";
      let branchId: string | null = null;
      const orderId = challan.orderId;

      if (orderId) {
        try {
          const [order, prefill] = await Promise.all([
            getPurchaseOrder(orderId).catch(() => null),
            getProjectPoPrefill(orderId).catch(() => null),
          ]);
          branchId = prefill?.branch_id || order?.branch_id || null;
          if (!customerPoDate && order?.document_date) {
            customerPoDate = String(order.document_date).slice(0, 10);
          }
          const ovfId =
            prefill?.ovf_id ||
            (order?.source_module?.toLowerCase().includes("ovf")
              ? order.source_document_id
              : null) ||
            order?.source_document_id ||
            null;
          if (ovfId) {
            const preview = await getScmOvfPreview(String(ovfId)).catch(() => null);
            oemName = preview?.oem_name?.trim() || "";
            crmProjectTitle = preview?.project_title?.trim() || "";
            if (!customerPoDate && preview?.po_date) {
              customerPoDate = String(preview.po_date).slice(0, 10);
            }
          }
        } catch {
          // Keep challan/status auto fields when API enrich fails.
        }
      }

      const projectName = crmProjectTitle || install.projectName || "";
      const deliveredQty = challanDeliveredQuantity(challan);
      const deliveredQtyDigits = String(deliveredQty ?? "").replace(/[^\d]/g, "");
      setManual({
        projectName,
        circleName: install.circleName,
        site: install.site,
        contactPerson: install.contactPerson,
        contactNumber: install.contactNumber,
        rackQuantity: install.rackQuantity,
        serverQuantity: install.serverQuantity || deliveredQtyDigits,
        serverType: install.serverType,
      });
      setShared({
        sharedToProject: install.sharedToProject,
        projectHref: install.projectHref,
      });
      setCrmProjectTitle(crmProjectTitle);

      const shipmentStatus = isFailedShipmentStatus(status.shipmentStatus)
        ? "Failed delivery"
        : isDeliveredShipmentStatus(status.shipmentStatus) ||
            Boolean(status.actualDeliveryDate?.trim())
          ? "Delivered"
          : status.shipmentStatus || "Delivered";

      setAuto({
        deliveredDate: status.actualDeliveryDate || "",
        shipmentStatus,
        oemName,
        companyPoNumber:
          status.cachePoNumber ||
          challan.companyPoNumber ||
          challan.purchaseOrderNumber ||
          "",
        shipToAddress:
          status.deliveryLocation ||
          challan.customerShipTo ||
          challan.customerBillTo ||
          "",
        quantity: challanDeliveredQuantity(challan),
        customerName: status.customerName || challan.customerName || "",
        customerPoNumber: status.customerPoNumber || "",
        customerPoDate,
        challanNumber: challan.challanNumber?.trim() || "",
        invoiceNumber:
          status.cacheInvoiceNumber?.trim() ||
          status.billInvoiceNumber?.trim() ||
          challan.invoiceNumber?.trim() ||
          "",
        orderId,
        branchId,
      });
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [challanId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hydrated || shared.sharedToProject) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const existing = resolveInstallation(challanId);
        upsertInstallation({
          ...existing,
          ...manual,
        });
      } catch {
        // Ignore transient localStorage write failures while typing.
      }
    }, 350);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [manual, challanId, hydrated, shared.sharedToProject]);

  function patchManual(partial: Partial<InstallationManualFields>) {
    setManual((prev) => ({ ...prev, ...partial }));
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors(validateInstallationManual({ ...manual, ...partial }));
    }
  }

  async function shareToProject() {
    if (!auto) return;
    const errors = validateInstallationManual(manual);
    setFieldErrors(errors);
    const message = firstInstallationError(errors);
    if (message) {
      setError(message);
      return;
    }
    if (!auto.orderId) {
      setError("This challan has no purchase order link. Cannot share to Projects.");
      return;
    }

    setSharing(true);
    setError(null);
    setBanner(null);
    try {
      upsertInstallation({
        ...resolveInstallation(challanId),
        ...manual,
      });

      const prefill = await getProjectPoPrefill(auto.orderId).catch(() => null);
      const branchId = prefill?.branch_id || auto.branchId;
      if (!branchId) {
        setError("Could not resolve branch for project create.");
        return;
      }

      const rackQty = Number(manual.rackQuantity);
      const serverQty = Number(manual.serverQuantity);
      const remarks = [
        `Contact: ${manual.contactPerson} (${manual.contactNumber})`,
        `Server type: ${manual.serverType}`,
        `Server quantity: ${manual.serverQuantity}`,
        `Rack quantity: ${manual.rackQuantity}`,
        auto.oemName ? `OEM: ${auto.oemName}` : null,
        auto.deliveredDate ? `Delivered: ${auto.deliveredDate}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const saved = await createProject({
        branch_id: branchId,
        project_name: manual.projectName.trim(),
        customer_id: prefill?.customer_id || undefined,
        proc_order_id: auto.orderId,
        description: remarks,
        site_installation: {
          delivery_type: "server_os_rack",
          site_name: manual.site.trim(),
          circle: manual.circleName.trim(),
          requestor_name: manual.contactPerson.trim(),
          application: manual.serverType.trim(),
          server_qty: Number.isFinite(serverQty) ? serverQty : null,
          rack_qty: Number.isFinite(rackQty) ? rackQty : null,
          remarks,
        },
      });

      try {
        await updateSiteInstallationByProject(saved.id, {
          delivery_type: "server_os_rack",
          site_name: manual.site.trim(),
          circle: manual.circleName.trim(),
          requestor_name: manual.contactPerson.trim(),
          application: manual.serverType.trim(),
          remarks,
          server_qty: Number.isFinite(serverQty) ? serverQty : null,
          rack_qty: Number.isFinite(rackQty) ? rackQty : null,
        });
        if (manual.site.trim()) {
          await advanceSiteInstallation(saved.id, "complete_intake").catch(() => undefined);
        }
      } catch {
        // Project exists; site fields may still be editable in Projects.
      }

      const linked = markInstallationSharedToProject(challanId, saved.id);
      setShared({
        sharedToProject: true,
        projectHref: linked.projectHref,
      });
      setBanner("Shared to Project module.");
      router.push(`/projects/projects/${saved.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to share to Project module",
      );
    } finally {
      setSharing(false);
    }
  }

  const detailsComplete = useMemo(
    () => Object.keys(validateInstallationManual(manual)).length === 0,
    [manual],
  );

  const autoItems = useMemo(() => {
    if (!auto) return [];
    return [
      { label: "Company PO number", value: textOrDash(auto.companyPoNumber) },
      { label: "Customer name", value: textOrDash(auto.customerName) },
      { label: "Customer PO number", value: textOrDash(auto.customerPoNumber) },
      { label: "Customer PO date", value: textOrDash(auto.customerPoDate) },
      { label: "Delivered date", value: textOrDash(auto.deliveredDate) },
      { label: "Challan number", value: textOrDash(auto.challanNumber) },
      { label: "Invoice number", value: textOrDash(auto.invoiceNumber) },
      { label: "OEM name", value: textOrDash(auto.oemName) },
      { label: "Ship to address", value: textOrDash(auto.shipToAddress) },
      { label: "Quantity", value: textOrDash(auto.quantity) },
    ];
  }, [auto]);

  return (
    <div className="space-y-4">
      <ProcurementPageHeader
        title="Installation details"
        backHref={installationListHref()}
        backLabel="Installation"
        actions={
          shared.projectHref ? (
            <Link
              href={shared.projectHref}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              Open project
            </Link>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {banner ? (
        <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {banner}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading installation details…
        </div>
      ) : null}

      {!loading && auto ? (
        <>
          <DeliverySectionCard
            title="From delivery / PO / OVF"
            icon={ClipboardList}
            subtitle="Read-only delivery and PO values. Status stays visible after delivery."
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Delivery status
              </span>
              <Badge
                variant={shipmentStatusBadgeVariant(auto.shipmentStatus)}
                className={procurementUi.statusBadge}
              >
                {auto.shipmentStatus}
              </Badge>
              {shared.sharedToProject ? (
                <Badge variant="secondary" className={procurementUi.statusBadge}>
                  Shared to project
                </Badge>
              ) : (
                <Badge variant="outline" className={procurementUi.statusBadge}>
                  Pending project share
                </Badge>
              )}
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {autoItems.map((item) => (
                <div key={item.label} className="min-w-0 space-y-1">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-sm font-normal break-words whitespace-pre-wrap text-muted-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </DeliverySectionCard>

          <DeliverySectionCard
            title="Site installation details"
            icon={MapPinned}
            subtitle="Details save automatically as you type. Share to Projects when all required fields are complete."
          >
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FinanceField
                label="Project name *"
                error={fieldErrors.projectName}
                hint={
                  crmProjectTitle
                    ? "Auto-filled from CRM project title."
                    : undefined
                }
              >
                <Input
                  value={manual.projectName}
                  onChange={(e) => patchManual({ projectName: e.target.value })}
                  className="h-8"
                  placeholder={crmProjectTitle ? "From CRM" : "Project name"}
                  disabled={shared.sharedToProject || Boolean(crmProjectTitle)}
                  readOnly={Boolean(crmProjectTitle)}
                />
              </FinanceField>
              <FinanceField label="Circle name *" error={fieldErrors.circleName}>
                <Input
                  value={manual.circleName}
                  onChange={(e) => patchManual({ circleName: e.target.value })}
                  className="h-8"
                  placeholder="Circle"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField label="Site *" error={fieldErrors.site}>
                <Input
                  value={manual.site}
                  onChange={(e) => patchManual({ site: e.target.value })}
                  className="h-8"
                  placeholder="Site name / location"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField label="Contact person *" error={fieldErrors.contactPerson}>
                <Input
                  value={manual.contactPerson}
                  onChange={(e) => patchManual({ contactPerson: e.target.value })}
                  className="h-8"
                  placeholder="Name"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField label="Contact number *" error={fieldErrors.contactNumber}>
                <Input
                  value={manual.contactNumber}
                  onChange={(e) => patchManual({ contactNumber: e.target.value })}
                  className="h-8"
                  placeholder="Phone"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField label="Rack quantity *" error={fieldErrors.rackQuantity}>
                <Input
                  value={manual.rackQuantity}
                  onChange={(e) =>
                    patchManual({ rackQuantity: e.target.value.replace(/[^\d]/g, "") })
                  }
                  className="h-8"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField label="Server quantity *" error={fieldErrors.serverQuantity}>
                <Input
                  value={manual.serverQuantity}
                  onChange={(e) =>
                    patchManual({ serverQuantity: e.target.value.replace(/[^\d]/g, "") })
                  }
                  className="h-8"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
              <FinanceField
                label="Server type *"
                error={fieldErrors.serverType}
                className="sm:col-span-2 lg:col-span-3"
              >
                <Input
                  value={manual.serverType}
                  onChange={(e) => patchManual({ serverType: e.target.value })}
                  className="h-8"
                  placeholder="Server / hardware type"
                  disabled={shared.sharedToProject}
                />
              </FinanceField>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={
                  sharing || !auto || shared.sharedToProject || !detailsComplete
                }
                onClick={() => void shareToProject()}
              >
                <FolderInput className="mr-1.5 size-3.5" />
                {sharing
                  ? "Sharing…"
                  : shared.sharedToProject
                    ? "Already shared"
                    : "Share to Project module"}
              </Button>
            </div>
            {!detailsComplete && !shared.sharedToProject ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Complete all required site fields before sharing to Projects.
              </p>
            ) : null}
          </DeliverySectionCard>
        </>
      ) : null}
    </div>
  );
}
