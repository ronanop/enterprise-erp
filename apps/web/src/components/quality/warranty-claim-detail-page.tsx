"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ModuleCrossLink,
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { QmSelectField } from "@/components/quality/quality-form-fields";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import {
  getQualityWarrantyClaim,
  loadQmOptions,
  qualityWarrantyClaimAction,
  updateQualityWarrantyClaim,
  type QualityWarrantyClaim,
  type QmOption,
} from "@/services/quality-service";

function warrantyActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "investigate", label: "Start investigation" }];
  if (s === "investigating") {
    return [
      { key: "accept", label: "Accept claim" },
      { key: "reject", label: "Reject claim" },
      { key: "link-capa", label: "Link CAPA" },
      { key: "close", label: "Close claim" },
    ];
  }
  if (s === "accepted") {
    return [
      { key: "link-capa", label: "Link CAPA" },
      { key: "close", label: "Close claim" },
    ];
  }
  if (s === "rejected" || s === "capa_linked") return [{ key: "close", label: "Close claim" }];
  return [];
}

export function WarrantyClaimDetailPage({ claimId }: { claimId: string }) {
  const [row, setRow] = useState<QualityWarrantyClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capaId, setCapaId] = useState("");
  const [capas, setCapas] = useState<QmOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claim, opts] = await Promise.all([getQualityWarrantyClaim(claimId), loadQmOptions()]);
      setRow(claim);
      setCapas(opts.capas);
      if (claim.capa_id) setCapaId(claim.capa_id);
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load warranty claim");
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (row ? warrantyActions(row.status) : []), [row]);

  async function onWorkflow(action: string) {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "accept" || action === "reject") {
        await updateQualityWarrantyClaim(row.id, { status: action === "accept" ? "accepted" : "rejected" });
      } else if (action === "link-capa") {
        if (!capaId) {
          setError("Select a CAPA to link.");
          setBusy(false);
          return;
        }
        await qualityWarrantyClaimAction(row.id, "link-capa", { capa_id: capaId });
      } else {
        await qualityWarrantyClaimAction(row.id, action as "investigate" | "close");
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={row?.document_number ?? "Warranty claim"}
      subtitle="VIN-linked warranty claim — separate from customer complaint KPIs"
      backHref="/quality/warranty-claims"
      backLabel="Back to warranty claims"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
          {row && !row.ncr_id ? (
            <Link
              href={`/quality/ncrs/new?source=warranty&description=${encodeURIComponent(row.description ?? "")}`}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Raise NCR
            </Link>
          ) : null}
        </div>
      }
    >
      {row ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Claim Details">
            <ModuleDetailGrid
              items={[
                { label: "Date", value: textOrDash(row.document_date) },
                { label: "VIN", value: textOrDash(row.vin) },
                { label: "Type", value: textOrDash(row.claim_type) },
                { label: "Quantity", value: String(row.quantity) },
                { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
                { label: "Description", value: textOrDash(row.description), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>
          <ModuleDetailSection title="Links">
            <ModuleDetailGrid
              items={[
                {
                  label: "VIN trace",
                  value: (
                    <ModuleCrossLink href={`/quality/vin-traces/${row.vin_trace_id}`} label="View VIN trace" />
                  ),
                },
                {
                  label: "Linked NCR",
                  value: row.ncr_id ? (
                    <ModuleCrossLink href={`/quality/ncrs/${row.ncr_id}`} label="View NCR" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Linked CAPA",
                  value: row.capa_id ? (
                    <ModuleCrossLink href={`/quality/capas/${row.capa_id}`} label="View CAPA" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Source complaint",
                  value: row.customer_complaint_id ? (
                    <ModuleCrossLink
                      href={`/quality/complaints/${row.customer_complaint_id}`}
                      label="View complaint"
                    />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
            {row.status === "investigating" || row.status === "accepted" ? (
              <div className="mt-4 max-w-sm">
                <QmSelectField label="CAPA to link" value={capaId} onChange={setCapaId} options={capas} />
              </div>
            ) : null}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
