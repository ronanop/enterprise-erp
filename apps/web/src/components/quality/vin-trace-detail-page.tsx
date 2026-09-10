"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ModuleCrossLink,
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import { getQualityVinTrace, type QualityVinTrace } from "@/services/quality-service";

export function VinTraceDetailPage({ traceId }: { traceId: string }) {
  const [row, setRow] = useState<QualityVinTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualityVinTrace(traceId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load VIN trace");
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModuleDetailPage
      title={row?.vin ?? "VIN trace"}
      subtitle="Vehicle-level as-built trace — linked to lot FQC, not stored on the inspection"
      backHref="/quality/vin-traces"
      backLabel="Back to VIN traces"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {row ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Vehicle">
            <ModuleDetailGrid
              items={[
                { label: "VIN", value: textOrDash(row.vin) },
                { label: "Document", value: textOrDash(row.document_number) },
                { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
                {
                  label: "Final inspection (lot)",
                  value: row.final_inspection_id ? (
                    <ModuleCrossLink
                      href={`/quality/final-inspections/${row.final_inspection_id}`}
                      label="View FQC lot"
                    />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </ModuleDetailSection>
          <ModuleDetailSection title="As-built components">
            {row.components.length === 0 ? (
              <p className="text-sm text-muted-foreground">No component batches recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Line</th>
                      <th className="py-2 pr-3 font-medium">Component</th>
                      <th className="py-2 pr-3 font-medium">Batch</th>
                      <th className="py-2 pr-3 font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.components.map((line) => (
                      <tr key={line.id} className="border-b border-border">
                        <td className="py-2 pr-3">{line.line_number}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{line.product_id}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{textOrDash(line.batch_id)}</td>
                        <td className="py-2 pr-3">{line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
