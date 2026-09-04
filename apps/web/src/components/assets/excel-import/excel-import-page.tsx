"use client";

import { FileUp, Loader2 } from "lucide-react";

import { ExcelImportMappingPanel } from "@/components/assets/excel-import/excel-import-mapping";
import { ExcelImportPreviewGrid } from "@/components/assets/excel-import/excel-import-preview";
import { ExcelImportValidationSummaryPanel } from "@/components/assets/excel-import/excel-import-summary";
import {
  EXCEL_IMPORT_STEP_LABELS,
  EXCEL_IMPORT_STEPS,
  type ExcelImportColumnMapping,
  type ExcelImportFieldKey,
  type ExcelImportIssue,
  type ExcelImportRowStatus,
  type ExcelImportStep,
  type ExcelImportTemplateResult,
  type ExcelImportValidationSummary,
} from "@/components/assets/excel-import/excel-import.types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ExcelImportPageProps = {
  step: ExcelImportStep;
  busy?: boolean;
  fatalError?: string | null;
  fileName?: string | null;
  headers?: string[];
  mapping: ExcelImportColumnMapping;
  template?: ExcelImportTemplateResult | null;
  validation?: ExcelImportValidationSummary | null;
  previewFilter: ExcelImportRowStatus | "all";
  onPreviewFilterChange: (filter: ExcelImportRowStatus | "all") => void;
  onFileSelected: (file: File) => void;
  onMappingChange: (field: ExcelImportFieldKey, header: string | null) => void;
  onConfirmMapping: () => void;
  onBackToMapping: () => void;
  onReset: () => void;
  categories?: Array<{ id: string; label: string }>;
  defaultCategoryId?: string;
  onDefaultCategoryChange?: (id: string) => void;
  confirmWarnings?: boolean;
  onConfirmWarningsChange?: (value: boolean) => void;
  importEnabled?: boolean;
  onImport?: () => void;
  importSummary?: {
    total_rows: number;
    imported: number;
    skipped: number;
    duplicates: number;
    warnings: number;
    failed: number;
    duration_ms: number;
    batch_count: number;
  } | null;
};

export function ExcelImportPage({
  step,
  busy,
  fatalError,
  fileName,
  headers = [],
  mapping,
  template,
  validation,
  previewFilter,
  onPreviewFilterChange,
  onFileSelected,
  onMappingChange,
  onConfirmMapping,
  onBackToMapping,
  onReset,
  categories = [],
  defaultCategoryId = "",
  onDefaultCategoryChange,
  confirmWarnings = false,
  onConfirmWarningsChange,
  importEnabled = false,
  onImport,
  importSummary = null,
}: ExcelImportPageProps) {
  return (
    <div className="space-y-6" data-testid="excel-import-page">
      <PageHeader
        title="Asset register import"
        description="Upload Excel/CSV, validate, preview, then import validated rows through ERP workflows."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={onReset}
          >
            Start over
          </Button>
        }
      />

      <ol
        className="flex flex-wrap gap-2"
        aria-label="Import steps"
        data-testid="excel-import-stepper"
      >
        {EXCEL_IMPORT_STEPS.map((s) => {
          const active = s === step;
          const idx = EXCEL_IMPORT_STEPS.indexOf(s);
          const currentIdx = EXCEL_IMPORT_STEPS.indexOf(step);
          const done = idx < currentIdx;
          return (
            <li
              key={s}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                active && "border-primary bg-primary text-primary-foreground",
                done && !active && "border-border bg-muted/40 text-foreground",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {idx + 1}. {EXCEL_IMPORT_STEP_LABELS[s]}
            </li>
          );
        })}
      </ol>

      {fatalError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="excel-import-fatal-error">
          {fatalError}
        </p>
      ) : null}

      {step === "select" || step === "parse" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Accepted formats: .xlsx, .xls, .csv. Parsing uses the first sheet only.
            </p>
            <label
              className={cn(
                "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-4 text-sm font-medium transition-colors duration-200 hover:bg-muted/50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileUp className="size-4" aria-hidden />
              )}
              {busy ? "Parsing…" : "Choose file"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                data-testid="excel-import-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                  e.target.value = "";
                }}
              />
            </label>
            {fileName ? (
              <p className="text-xs text-muted-foreground" data-testid="excel-import-file-name">
                Selected: {fileName}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "template" && template ? (
        <Card data-testid="excel-import-template-panel">
          <CardHeader>
            <CardTitle className="text-base">Template check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <IssueList issues={template.issues} />
            {template.ok ? (
              <p className="text-sm text-emerald-700">Template looks ready. Continue to mapping.</p>
            ) : (
              <p className="text-sm text-destructive">
                Fix missing required columns via mapping or re-upload a corrected file.
              </p>
            )}
            <Button
              type="button"
              className="cursor-pointer"
              onClick={onConfirmMapping}
              data-testid="excel-import-continue-mapping"
            >
              Review column mapping
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "mapping" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExcelImportMappingPanel
              headers={headers}
              mapping={mapping}
              onChange={onMappingChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="cursor-pointer"
                disabled={busy}
                onClick={onConfirmMapping}
                data-testid="excel-import-run-validation"
              >
                {busy ? "Validating…" : "Validate rows & preview"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              After preview, import runs only for validated rows through ERP business services.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" && validation ? (
        <div className="space-y-4" data-testid="excel-import-preview-stage">
          <ExcelImportValidationSummaryPanel summary={validation} />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Preview filter">
            {(
              [
                ["all", "All"],
                ["valid", "Valid"],
                ["warning", "Warnings"],
                ["invalid", "Invalid"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={previewFilter === id}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors duration-200",
                  previewFilter === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted/60",
                )}
                onClick={() => onPreviewFilterChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <ExcelImportPreviewGrid rows={validation.previewRows} filter={previewFilter} />
          <div className="space-y-3 rounded-md border border-border p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={confirmWarnings}
                onChange={(e) => onConfirmWarningsChange?.(e.target.checked)}
                data-testid="excel-import-confirm-warnings"
              />
              Import warning rows (explicit confirmation)
            </label>
          </div>
          {importSummary ? (
            <Card data-testid="excel-import-result-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Import result</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm sm:grid-cols-2 md:grid-cols-4">
                <p>Total: {importSummary.total_rows}</p>
                <p>Imported: {importSummary.imported}</p>
                <p>Skipped: {importSummary.skipped}</p>
                <p>Duplicates: {importSummary.duplicates}</p>
                <p>Warnings: {importSummary.warnings}</p>
                <p>Failed: {importSummary.failed}</p>
                <p>Batches: {importSummary.batch_count}</p>
                <p>Duration: {importSummary.duration_ms} ms</p>
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={onBackToMapping}
            >
              Back to mapping
            </Button>
            <Button
              type="button"
              className={
                importEnabled && !busy
                  ? "cursor-pointer transition-colors duration-200"
                  : "cursor-not-allowed opacity-60"
              }
              disabled={!importEnabled || busy}
              onClick={() => onImport?.()}
              data-testid="excel-import-execute"
              title={
                importEnabled
                  ? "Import validated rows"
                  : "Ensure valid rows exist before importing"
              }
            >
              {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IssueList({ issues }: { issues: ExcelImportIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">No template issues.</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="excel-import-template-issues">
      {issues.map((issue, idx) => (
        <li
          key={`${issue.code}-${idx}`}
          className={issue.severity === "error" ? "text-destructive" : "text-amber-800"}
        >
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
