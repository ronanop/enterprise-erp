"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";

import { SITE_DELIVERY_TYPES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
  type Lookups,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  createProject,
  getProject,
  getProjectPoPrefill,
  getSiteInstallationByProject,
  listBranchOptions,
  listCustomerOptions,
  listProjectManagementTeamOptions,
  updateProject,
  updateSiteInstallationByProject,
  type ProjectFormInput,
} from "@/services/projects-portal-service";
import { getPurchaseOrder, getScmOvfPreview } from "@/services/procurement-service";
import { challanDeliveredQuantity } from "@/utils/delivery-challan-bill";
import { listDeliveryChallansByOrderId } from "@/utils/delivery-challan-storage";
import { resolveScmInstallationPrefillForOrder } from "@/utils/installation-storage";
import { getProjectPoQueueHandoff } from "@/utils/project-po-queue-handoff";

function digitsOnly(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/[^\d]/g, "");
}

function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Older SCM shares stored type/qty only in remarks text. */
function valueFromRemarks(remarks: string | null | undefined, label: string): string {
  if (!remarks?.trim()) return "";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = remarks.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match?.[1]?.trim().split(/\r?\n/)[0]?.trim() || "";
}

const EMPTY_CREATE: FormValues = {
  branch_id: "",
  circle: "",
  company_po_number: "",
  customer_po_number: "",
  customer_id: "",
  customer_label: "",
  delivery_type: "server_os_rack",
  project_name: "",
  rack_qty: "",
  server_qty: "",
  server_type: "",
  site_name: "",
  project_manager_employee_id: "",
  rfai_request_done: "",
  rfai_number: "",
};

const EMPTY_EDIT: FormValues = {
  ...EMPTY_CREATE,
  project_code: "",
  status: "draft",
};

export function ProjectFormPage({ projectId }: { projectId?: string }) {
  const isEdit = Boolean(projectId);
  const searchParams = useSearchParams();
  const poId = searchParams.get("po_id");
  const [linkedPoId, setLinkedPoId] = useState<string | null>(poId);

  const load = useCallback(async (): Promise<{ values?: FormValues; lookups?: Lookups }> => {
    const [branches, team, customers, record, prefill] = await Promise.all([
      listBranchOptions().catch(() => []),
      listProjectManagementTeamOptions().catch(() => []),
      listCustomerOptions().catch(() => []),
      projectId ? getProject(projectId) : Promise.resolve(null),
      !projectId && poId ? getProjectPoPrefill(poId).catch(() => null) : Promise.resolve(null),
    ]);
    const resolvedCustomerLabel =
      prefill?.customer_name?.trim() ||
      (prefill?.customer_id
        ? customers.find((c) => c.id === prefill.customer_id)?.label
        : undefined) ||
      "";

    const lookups: Lookups = {
      branches,
      employees: team,
      pmTeam: team,
      customers,
    };

    if (record) {
      const site = await getSiteInstallationByProject(projectId!).catch(() => null);
      const customerLabel =
        customers.find((c) => c.id === record.customer_id)?.label ?? "";

      setLinkedPoId(record.proc_order_id);
      let companyPoNumber = "";
      let customerPoNumber = "";
      if (record.proc_order_id) {
        try {
          const order = await getPurchaseOrder(record.proc_order_id);
          companyPoNumber = order.company_po_number || order.document_number || "";
          customerPoNumber = (order.customer_po_number || "").trim();
          if (!customerPoNumber) {
            const handoff = getProjectPoQueueHandoff(record.proc_order_id);
            customerPoNumber = (handoff?.customerPoNumber || "").trim();
          }
        } catch {
          companyPoNumber = "";
          customerPoNumber = "";
        }
      }

      const values: FormValues = {
        project_code: record.project_code,
        project_name: record.project_name,
        status: record.status,
        branch_id: record.branch_id,
        circle: site?.circle ?? "",
        company_po_number: companyPoNumber,
        customer_po_number: customerPoNumber,
        customer_id: record.customer_id ?? "",
        customer_label: customerLabel,
        delivery_type: site?.delivery_type || "server_os_rack",
        // Prefill from SCM Installation → Projects share (rack/server qty + server type).
        rack_qty:
          digitsOnly(site?.rack_qty) ||
          digitsOnly(valueFromRemarks(site?.remarks, "Rack quantity")),
        server_qty:
          digitsOnly(site?.server_qty) ||
          digitsOnly(valueFromRemarks(site?.remarks, "Server quantity")),
        server_type:
          site?.application?.trim() ||
          valueFromRemarks(site?.remarks, "Server type") ||
          "",
        site_name: site?.site_name ?? "",
        project_manager_employee_id: record.project_manager_employee_id,
        rfai_request_done: site?.rfai_request_done ? "true" : "false",
        rfai_number: site?.rfai_number ?? "",
      };
      return { values, lookups };
    }

    setLinkedPoId(poId);

    // Create-from-PO: pull title/qty/type from SCM Installation + CRM OVF.
    let scmInstall: ReturnType<typeof resolveScmInstallationPrefillForOrder> = null;
    let ovfProjectTitle = "";
    let ovfOemName = "";
    let receivedQtyDigits = "";
    let orderCustomerPo = "";

    try {
      scmInstall = poId ? resolveScmInstallationPrefillForOrder(poId) : null;
    } catch {
      scmInstall = null;
    }

    if (poId) {
      try {
        const [order, ovfPreview] = await Promise.all([
          getPurchaseOrder(poId).catch(() => null),
          prefill?.ovf_id
            ? getScmOvfPreview(String(prefill.ovf_id)).catch(() => null)
            : Promise.resolve(null),
        ]);
        ovfProjectTitle = (ovfPreview?.project_title || "").trim();
        ovfOemName = (ovfPreview?.oem_name || "").trim();
        orderCustomerPo = (order?.customer_po_number || "").trim();
        if (!orderCustomerPo && ovfPreview?.po_number) {
          orderCustomerPo = String(ovfPreview.po_number).trim();
        }

        const fromOrder = (order?.lines || []).reduce((sum, ln) => {
          const qty = Number(ln.quantity_received) || 0;
          return sum + (Number.isFinite(qty) ? Math.max(0, qty) : 0);
        }, 0);
        if (fromOrder > 0) {
          receivedQtyDigits = digitsOnly(fromOrder);
        } else {
          const challans = listDeliveryChallansByOrderId(poId);
          const fromChallan = challans.reduce((sum, challan) => {
            try {
              return sum + challanDeliveredQuantity(challan);
            } catch {
              return sum;
            }
          }, 0);
          if (fromChallan > 0) receivedQtyDigits = digitsOnly(fromChallan);
        }
      } catch {
        // Prefill enrichment is best-effort — base PO prefill still loads.
      }
    }

    const projectTitle =
      scmInstall?.projectName?.trim() ||
      prefill?.project_title?.trim() ||
      ovfProjectTitle ||
      "";
    const rackQty = digitsOnly(scmInstall?.rackQuantity);
    const serverQty =
      digitsOnly(scmInstall?.serverQuantity) || receivedQtyDigits;
    const serverType =
      scmInstall?.serverType?.trim() || ovfOemName || "";

    const handoff = poId ? getProjectPoQueueHandoff(poId) : null;
    const customerPoNumber =
      (handoff?.customerPoNumber || "").trim() ||
      (prefill?.customer_po_number || "").trim() ||
      orderCustomerPo ||
      "";

    return {
      values: {
        branch_id: prefill?.branch_id || branches[0]?.id || "",
        // Circle shows the lead entity state (GST / address), falling back to entity name.
        circle:
          scmInstall?.circleName?.trim() ||
          prefill?.entity_state?.trim() ||
          prefill?.circle_name?.trim() ||
          "",
        company_po_number: prefill?.company_po_number?.trim() || "",
        customer_po_number: customerPoNumber,
        customer_id: prefill?.customer_id || "",
        customer_label: resolvedCustomerLabel || (handoff?.customerName || "").trim() || "",
        project_name: projectTitle,
        rack_qty: rackQty,
        server_qty: serverQty,
        server_type: serverType,
        site_name: scmInstall?.site?.trim() || prefill?.site_name || "",
        project_manager_employee_id: team[0]?.id ?? "",
        rfai_request_done: "false",
      },
      lookups,
    };
  }, [projectId, poId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      if (!isEdit) {
        const siteName = v.site_name.trim();
        const projectTitle = v.project_name.trim();
        const rfaiYes = v.rfai_request_done === "true";
        const saved = await createProject({
          branch_id: v.branch_id,
          project_name: projectTitle || undefined,
          customer_id: orNull(v.customer_id),
          project_manager_employee_id: v.project_manager_employee_id || undefined,
          proc_order_id: poId || undefined,
          site_installation: {
            delivery_type: v.delivery_type || "server_os_rack",
            site_name: orNull(siteName),
            circle: orNull(v.circle),
            application: orNull(v.server_type),
            server_qty: intOrNull(v.server_qty),
            rack_qty: intOrNull(v.rack_qty),
            rfai_request_done: rfaiYes,
            rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          },
        });
        // Intake was captured on create — move to Survey so admin assigns Survey from Project Tracking.
        if (siteName) {
          try {
            await advanceSiteInstallation(saved.id, "complete_intake");
          } catch {
            // Stay on intake if gates fail; admin can still assign Survey from tracking.
          }
        }
        return `/projects/projects/${saved.id}`;
      }

      const rfaiYes = v.rfai_request_done === "true";
      const siteName = v.site_name.trim();
      const projectPayload: ProjectFormInput = {
        project_name: v.project_name.trim() || siteName || "Site Installation Request",
        customer_id: orNull(v.customer_id),
        project_manager_employee_id: v.project_manager_employee_id,
        status: v.status || "draft",
      };

      await Promise.all([
        updateProject(projectId!, projectPayload),
        updateSiteInstallationByProject(projectId!, {
          delivery_type: v.delivery_type || "server_os_rack",
          site_name: orNull(siteName),
          rfai_request_done: rfaiYes,
          rfai_number: rfaiYes ? orNull(v.rfai_number) : null,
          circle: orNull(v.circle),
          application: orNull(v.server_type),
          server_qty: intOrNull(v.server_qty),
          rack_qty: intOrNull(v.rack_qty),
        }),
      ]);

      return `/projects/projects/${projectId}`;
    },
    [isEdit, projectId, poId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const showPoReadonlyIntake = Boolean(poId) || Boolean(linkedPoId);

    const intakeFields: FormSection["fields"] = [
      ...(isEdit
        ? [
          {
            name: "project_code",
            label: "Project Code",
            type: "readonly" as const,
          },
        ]
        : []),
      {
        name: "project_name",
        label: "Project Title",
        type: "text" as const,
        required: true,
        placeholder: "Project title",
      },
      {
        name: "circle",
        label: "Circle",
        type: "text" as const,
        placeholder: "Telecom circle…",
      },
      {
        name: "delivery_type",
        label: "Delivery Type",
        type: "select",
        required: true,
        options: SITE_DELIVERY_TYPES,
      },
      {
        name: "rack_qty",
        label: "Rack Quantity",
        type: "text" as const,
        placeholder: "0",
      },
      {
        name: "server_qty",
        label: "Server Quantity",
        type: "text" as const,
        placeholder: "0",
      },
      {
        name: "server_type",
        label: "Server Type",
        type: "text" as const,
        placeholder: "Server / hardware type",
      },
      ...(showPoReadonlyIntake
        ? [
          {
            name: "customer_po_number",
            label: "Customer PO Number",
            type: "readonly" as const,
          },
          {
            name: "customer_label",
            label: "Customer",
            type: "readonly" as const,
          },
          {
            name: "site_name",
            label: "Site Name",
            type: "readonly" as const,
            full: true as const,
          },
        ]
        : [
          {
            name: "customer_id",
            label: "Customer",
            type: "select" as const,
            required: true,
            optionsKey: "customers" as const,
            placeholder: "Select customer…",
            creatable: "customer" as const,
            createNewLabel: "New Customer…",
          },
          {
            name: "site_name",
            label: "Site Name",
            type: "textarea" as const,
            required: true,
            full: true as const,
            placeholder: "Site name / site list entry…",
          },
        ]),
      {
        name: "project_manager_employee_id",
        label: "Project Manager",
        type: "select",
        required: true,
        optionsKey: "pmTeam",
        placeholder: "Select project manager…",
      },
      {
        name: "rfai_request_done",
        label: "RFAI Request",
        type: "yesno",
        required: true,
        clearFieldsOnChange: ["rfai_number"],
      },
      {
        name: "rfai_number",
        label: "RFAI Number",
        type: "text",
        required: true,
        placeholder: "RFAI reference number…",
        visibleWhen: (vals) => vals.rfai_request_done === "true",
      },
    ];

    const poIntakeSubtitle =
      "Step 1 — Prefills from CRM (title) and SCM Installation / GRN quantities when available.";

    return [
      {
        title: "Intake / Site request",
        subtitle: showPoReadonlyIntake
          ? poIntakeSubtitle
          : isEdit
            ? "Step 1 — Customer → Site → Project Manager → RFAI."
            : "Step 1 — Customer → Site → Project Manager → RFAI. Project title / rack / server fields prefill from SCM Installation when available.",
        icon: MapPin,
        fields: intakeFields,
      },
    ];
  }, [isEdit, poId, linkedPoId]);

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Project" : "New Project"}
      description={
        isEdit
          ? linkedPoId || poId
            ? "Step 1 — Intake / Site request prefilled from the SCM purchase order."
            : "Step 1 — Intake / Site request. Schedule is managed from the project timeline."
          : poId
            ? "Step 1 — Intake / Site request prefilled from the SCM purchase order. After create you continue to Assign Survey owner."
            : "Step 1 — Intake / Site request. After create you continue to Assign Survey owner."
      }
      backHref={poId ? "/projects/po-queue" : "/projects/projects"}
      backLabel={poId ? "Back to PO queue" : "Back to projects"}
      submitLabel={isEdit ? "Save changes" : "Create project"}
      sections={sections}
      emptyValues={isEdit ? EMPTY_EDIT : EMPTY_CREATE}
      load={load}
      onSave={onSave}
    />
  );
}
