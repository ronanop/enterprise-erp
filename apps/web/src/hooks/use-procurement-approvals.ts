"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PROCUREMENT_APPROVALS_EVENT,
  readPoApprovals,
  setPoApprovalStatus,
  submitCreatePoInStockApproval,
  type PoApprovalRequest,
  type PoApprovalStatus,
} from "@/lib/procurement-approvals";
import { pushPoApprovalDecisionNotification } from "@/lib/procurement-approval-notifications";
import {
  acceptScmOvfCharges,
  acceptScmOvfHold,
  acceptScmPoApproval,
  collectPoApprovalDocuments,
  finalizeScmOrder,
  listScmChargeApprovals,
  listScmFinalizeApprovals,
  listScmHoldApprovals,
  rejectScmFinalizeApproval,
  rejectScmOvfCharges,
  rejectScmOvfHold,
  requestScmFinalizeApproval,
  type ScmChargeApproval,
  type ScmFinalizeApproval,
  type ScmHoldApproval,
} from "@/services/procurement-service";
import {
  ensureScmOvfPdfAttached,
  isScmOvfPdfAttachment,
} from "@/utils/scm-ovf-pdf-attach";
import { buildScmPoPrintPdfAttachment } from "@/utils/scm-po-pdf-attach";

function mapServerFinalize(row: ScmFinalizeApproval): PoApprovalRequest {
  return {
    id: row.id,
    kind: "finalize",
    orderId: row.order_id,
    documentNumber: row.document_number,
    companyPoNumber: row.company_po_number,
    customerName: row.customer_name,
    vendorId: String(row.vendor_id),
    vendorName: row.vendor_name,
    ovfId: row.ovf_id,
    ovfNo: row.ovf_no,
    reason: null,
    documents: [],
    requestedByRole: "user",
    requestedByName: (row.requested_by_name || "").trim() || null,
    status: row.status,
    createdAt: row.requested_at || new Date().toISOString(),
    decidedAt: row.decided_at,
    scmApprovalStage: row.scm_approval_stage ?? null,
    stageLabel: row.stage_label ?? null,
  };
}

function compareCompanyPoNumberDesc(a: PoApprovalRequest, b: PoApprovalRequest): number {
  const poA = (a.companyPoNumber || a.documentNumber || "").trim();
  const poB = (b.companyPoNumber || b.documentNumber || "").trim();
  if (poA !== poB) {
    return poB.localeCompare(poA, undefined, { numeric: true, sensitivity: "base" });
  }
  return b.createdAt.localeCompare(a.createdAt);
}

function generatedOvfPdfDocument(
  ovfId: string,
  ovfNo: string | null | undefined,
): PoApprovalRequest["documents"][number] {
  const safeNo = String(ovfNo || ovfId).replace(/[^\w.-]+/g, "_");
  return {
    id: `generated-ovf-pdf:${ovfId}`,
    fileName: `OVF-${safeNo}.pdf`,
    category: "ovf_pdf",
    remarks: "Auto-generated OVF PDF (same as View OVF → Download PDF)",
    entityType: "ovf",
    source: "ovf",
    attachmentSource: "generated",
    externalUrl: null,
  };
}

async function withOvfCommercialDocuments(
  rows: PoApprovalRequest[],
): Promise<PoApprovalRequest[]> {
  return Promise.all(
    rows.map(async (row) => {
      const ovfId = String(row.ovfId || "").trim();
      if (ovfId) {
        // Same PDF as View OVF → Download PDF (persists when requester/approver can upload).
        await ensureScmOvfPdfAttached(ovfId).catch(() => null);
      }

      const hasOvfPdf = row.documents.some((doc) =>
        isScmOvfPdfAttachment({
          category: doc.category,
          fileName: doc.fileName,
        }),
      );
      if (row.documents.length > 0 && hasOvfPdf) return row;

      const collected = await collectPoApprovalDocuments({
        orderId: row.orderId,
        ovfId: row.ovfId,
      }).catch(() => []);
      const documents = collected.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        category: doc.category,
        remarks: doc.remarks,
        entityType: doc.entityType,
        source: doc.source,
        attachmentSource: doc.attachmentSource,
        externalUrl: doc.externalUrl,
      }));

      const collectedHasOvfPdf = documents.some((doc) =>
        isScmOvfPdfAttachment({
          category: doc.category,
          fileName: doc.fileName,
        }),
      );
      // Always surface Download PDF for OVF-sourced approval requests.
      if (ovfId && !collectedHasOvfPdf) {
        documents.unshift(generatedOvfPdfDocument(ovfId, row.ovfNo));
      }

      if (documents.length === 0) return row;
      return { ...row, documents };
    }),
  );
}

function mapHoldApproval(row: ScmHoldApproval): PoApprovalRequest {
  return {
    id: `hold:${row.ovf_id}`,
    kind: "hold_ovf",
    orderId: row.ovf_id,
    documentNumber: row.ovf_no,
    companyPoNumber: null,
    customerName: row.customer_name,
    vendorId: "-",
    vendorName: row.owner_name,
    ovfId: row.ovf_id,
    ovfNo: row.ovf_no,
    reason: null,
    documents: [],
    requestedByRole: "user",
    requestedByName: row.requested_by_name,
    status: row.status,
    createdAt: row.requested_at || new Date().toISOString(),
    decidedAt: null,
    holdRemark: row.remark,
  };
}

function mapChargeApproval(row: ScmChargeApproval): PoApprovalRequest {
  const freight = Number(row.freight) || 0;
  const finance = Number(row.finance_cost_pct) || 0;
  const isNotice = row.status === "notified";
  return {
    id: `charges:${row.ovf_id}`,
    kind: "freight_finance",
    orderId: row.ovf_id,
    documentNumber: row.ovf_no,
    companyPoNumber: null,
    customerName: row.customer_name,
    vendorId: "-",
    vendorName: row.owner_name,
    ovfId: row.ovf_id,
    ovfNo: row.ovf_no,
    reason: null,
    documents: [],
    requestedByRole: "user",
    requestedByName: row.requested_by_name,
    status: row.status,
    createdAt: row.requested_at || new Date().toISOString(),
    decidedAt: isNotice ? row.requested_at || new Date().toISOString() : null,
    chargeSummary: isNotice
      ? `Freight changed to ₹${freight.toLocaleString("en-IN")} · Margin updated · No approval required`
      : `Freight ₹${freight.toLocaleString("en-IN")} · Finance ${finance}%`,
  };
}

function mergeApprovalRows(
  serverFinalize: PoApprovalRequest[],
  localCreatePo: PoApprovalRequest[],
): PoApprovalRequest[] {
  const byId = new Map<string, PoApprovalRequest>();
  for (const row of [...serverFinalize, ...localCreatePo]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort(compareCompanyPoNumberDesc);
}

export function useProcurementApprovals() {
  const [rows, setRows] = useState<PoApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const localCreatePo = readPoApprovals().filter((row) => row.kind === "create_po_in_stock");
    try {
      const [server, holds, charges] = await Promise.all([
        listScmFinalizeApprovals(),
        listScmHoldApprovals().catch(() => [] as ScmHoldApproval[]),
        listScmChargeApprovals().catch(() => [] as ScmChargeApproval[]),
      ]);
      setLoadError(null);
      const merged = mergeApprovalRows(
        [
          ...server.map(mapServerFinalize),
          ...holds.map(mapHoldApproval),
          ...charges.map(mapChargeApproval),
        ],
        localCreatePo,
      );
      // Attach OVF commercial pack (BOQ / SOW / quotes / etc.) for approval review.
      setRows(await withOvfCommercialDocuments(merged));
    } catch (err) {
      // Keep IN STOCK Create-PO requests visible even if the shared inbox fails.
      setLoadError(err instanceof Error ? err.message : "Failed to load finalize approvals");
      setRows(mergeApprovalRows([], localCreatePo));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onLocalChange = () => {
      void refresh();
    };
    window.addEventListener(PROCUREMENT_APPROVALS_EVENT, onLocalChange);
    window.addEventListener("storage", onLocalChange);
    return () => {
      window.removeEventListener(PROCUREMENT_APPROVALS_EVENT, onLocalChange);
      window.removeEventListener("storage", onLocalChange);
    };
  }, [refresh]);

  const pending = useMemo(
    () => rows.filter((row) => row.status === "pending"),
    [rows],
  );

  const submitFinalizeRequest = useCallback(
    async (orderId: string) => {
      const poPdf = await buildScmPoPrintPdfAttachment(orderId);
      const order = await requestScmFinalizeApproval(orderId, {
        po_pdf_base64: poPdf?.base64 ?? null,
        po_pdf_filename: poPdf?.filename ?? null,
      });
      await refresh();
      return order;
    },
    [refresh],
  );

  const submitCreatePoInStockRequest = useCallback(
    (input: Parameters<typeof submitCreatePoInStockApproval>[0]) => {
      const row = submitCreatePoInStockApproval(input);
      void refresh();
      return row;
    },
    [refresh],
  );

  const decide = useCallback(
    async (row: PoApprovalRequest, status: Exclude<PoApprovalStatus, "pending">) => {
      if (row.kind === "hold_ovf") {
        const ovfId = row.ovfId || row.orderId;
        if (status === "accepted") await acceptScmOvfHold(ovfId);
        else await rejectScmOvfHold(ovfId);
      } else if (row.kind === "freight_finance") {
        const ovfId = row.ovfId || row.orderId;
        if (status === "accepted") await acceptScmOvfCharges(ovfId);
        else await rejectScmOvfCharges(ovfId);
      } else if (row.kind === "finalize") {
        if (status === "accepted") {
          const stage = row.scmApprovalStage || "accept_po";
          if (stage === "accept_po") {
            await acceptScmPoApproval(row.orderId);
          } else {
            // Issued vendor mail must use a clean PDF (no DRAFT watermark).
            const poPdf = await buildScmPoPrintPdfAttachment(row.orderId, {
              watermark: false,
            });
            await finalizeScmOrder(row.orderId, {
              po_pdf_base64: poPdf?.base64 ?? null,
              po_pdf_filename: poPdf?.filename ?? null,
            });
          }
        } else {
          await rejectScmFinalizeApproval(row.orderId);
        }
      } else {
        setPoApprovalStatus(row.id, status);
      }
      pushPoApprovalDecisionNotification({
        approvalId: row.id,
        orderId: row.orderId,
        companyPoNumber: row.companyPoNumber,
        documentNumber: row.documentNumber,
        decision: status,
        kind: row.kind,
      });
      await refresh();
      return row;
    },
    [refresh],
  );

  return {
    rows,
    pending,
    pendingCount: pending.length,
    loading,
    loadError,
    submitFinalizeRequest,
    submitCreatePoInStockRequest,
    decide,
    refresh,
  };
}
