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
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import { getQualityPpap, qualityPpapAction, type QualityPpap } from "@/services/quality-service";

function workflowActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "submit", label: "Submit PPAP" }];
  if (s === "submitted") {
    return [
      { key: "approve", label: "Approve" },
      { key: "interim", label: "Interim approval" },
      { key: "reject", label: "Reject" },
    ];
  }
  return [];
}

export function PpapDetailPage({ ppapId }: { ppapId: string }) {
  const [ppap, setPpap] = useState<QualityPpap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPpap(await getQualityPpap(ppapId));
    } catch (err) {
      setPpap(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load PPAP");
    } finally {
      setLoading(false);
    }
  }, [ppapId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (ppap ? workflowActions(ppap.status) : []), [ppap]);

  async function onWorkflow(action: string) {
    if (!ppap) return;
    setBusy(true);
    try {
      await qualityPpapAction(ppap.id, action as "submit" | "approve" | "reject" | "interim");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={ppap?.document_number ?? "PPAP"}
      subtitle="Part Production Approval Process — documentary approval only"
      backHref="/quality/ppaps"
      backLabel="Back to PPAPs"
      status={ppap?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {ppap ? (
        <div className="space-y-6">
          <ModuleDetailSection title="PPAP Details">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(ppap.document_number) },
                { label: "Date", value: textOrDash(ppap.document_date) },
                { label: "Level", value: textOrDash(ppap.submission_level) },
                { label: "Status", value: <FinanceStatusBadge status={ppap.status} /> },
                {
                  label: "Control plan",
                  value: (
                    <ModuleCrossLink
                      href={`/quality/plans/${ppap.inspection_plan_id}`}
                      label="View inspection plan"
                    />
                  ),
                },
                {
                  label: "PFMEA",
                  value: ppap.pfmea_id ? (
                    <ModuleCrossLink href={`/quality/pfmeas/${ppap.pfmea_id}`} label="View PFMEA" />
                  ) : (
                    "—"
                  ),
                },
                { label: "Notes", value: textOrDash(ppap.notes), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>
          <p className="text-xs text-muted-foreground">
            PPAP approval does not move inventory. Use incoming / final inspections for stock
            disposition.
          </p>
          <Link
            href="/quality/ppaps"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Back to PPAP list
          </Link>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
