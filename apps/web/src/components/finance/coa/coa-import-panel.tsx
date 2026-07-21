"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadCoaImportTemplate } from "@/lib/finance/coa-export";
import { ApiClientError } from "@/services/api-client";
import { importAccounts, type CoaImportResult, type CoaImportRow } from "@/services/coa-service";

type Props = {
  onImported: () => void;
};

function parseBool(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return fallback;
}

export function CoaImportPanel({ onImported }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoaImportResult | null>(null);
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
      const rows: CoaImportRow[] = json.map((row) => ({
        account_group_id: row.account_group_id ? String(row.account_group_id) : null,
        account_group_code: row.account_group_code ? String(row.account_group_code) : null,
        account_code: String(row.account_code ?? ""),
        account_name: String(row.account_name ?? ""),
        account_type: String(row.account_type ?? ""),
        normal_balance: String(row.normal_balance ?? ""),
        parent_account_code: row.parent_account_code ? String(row.parent_account_code) : null,
        is_posting_account: parseBool(row.is_posting_account, true),
        is_cost_center_enabled: parseBool(row.is_cost_center_enabled, false),
        currency_code: row.currency_code ? String(row.currency_code) : null,
        description: row.description ? String(row.description) : null,
        status: row.status ? String(row.status) : "draft",
      }));
      const res = await importAccounts(rows);
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
          <p className="mt-1 text-xs text-muted-foreground">
            CSV import with validation summary. Use table toolbar for CSV/XLSX export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 cursor-pointer"
            onClick={() => downloadCoaImportTemplate()}
          >
            Download template
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium transition-colors hover:bg-muted/50">
            <FileUp className="size-3.5" />
            {busy ? "Importing…" : "Import CSV"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {result ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
          <p>
            Created <strong>{result.created}</strong> · Failed <strong>{result.failed}</strong>
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-destructive">
              {result.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
