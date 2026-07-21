"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadFiscalImportTemplate } from "@/lib/finance/fiscal-export";
import { ApiClientError } from "@/services/api-client";
import { importFiscalYears, type FiscalCreatePayload } from "@/services/fiscal-service";

type Props = { onImported: () => void };

export function FiscalImportPanel({ onImported }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const rows: FiscalCreatePayload[] = json.map((row) => ({
        fiscal_year_code: String(row.fiscal_year_code ?? ""),
        fiscal_year_name: String(row.fiscal_year_name ?? ""),
        start_date: String(row.start_date ?? ""),
        end_date: String(row.end_date ?? ""),
        description: row.description ? String(row.description) : null,
      }));
      const res = await importFiscalYears(rows);
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Import / Export</h3>
          <p className="mt-1 text-xs text-muted-foreground">CSV import with validation summary. Export via list toolbar.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => downloadFiscalImportTemplate()}>Template</Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium hover:bg-muted/50">
            <FileUp className="size-3.5" /> {busy ? "Importing…" : "Import CSV"}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {result ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
          <p>Created <strong>{result.created}</strong> · Failed <strong>{result.failed}</strong></p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-destructive">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
