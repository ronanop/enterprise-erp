"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AssetExcelImportSummaryDto,
} from "@/components/assets/excel-import/excel-import-api-mapper";
import { buildImportPayloadRows } from "@/components/assets/excel-import/excel-import-api-mapper";
import { executeExcelImport } from "@/components/assets/excel-import/excel-import-execute";
import { ExcelImportPage } from "@/components/assets/excel-import/excel-import-page";
import {
  buildMasterLookups,
  parseImportWorkbook,
  runRowValidation,
  runTemplateValidation,
} from "@/components/assets/excel-import/excel-import-service";
import { suggestColumnMapping } from "@/components/assets/excel-import/excel-import-mapper";
import {
  ExcelImportError,
  type ExcelImportColumnMapping,
  type ExcelImportFieldKey,
  type ExcelImportParseResult,
  type ExcelImportRowStatus,
  type ExcelImportStep,
  type ExcelImportTemplateResult,
  type ExcelImportValidationSummary,
} from "@/components/assets/excel-import/excel-import.types";
import { listBranchOptions, listDepartmentOptions, listEmployeeOptions } from "@/lib/org-options";
import {
  assetCategoryService,
  filterActiveCategories,
} from "@/services/assets-service";
import { listItAssetTypes } from "@/services/asset-type-service";

export function ExcelImportContainer() {
  const [step, setStep] = useState<ExcelImportStep>("select");
  const [busy, setBusy] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [parse, setParse] = useState<ExcelImportParseResult | null>(null);
  const [mapping, setMapping] = useState<ExcelImportColumnMapping>({});
  const [template, setTemplate] = useState<ExcelImportTemplateResult | null>(null);
  const [validation, setValidation] = useState<ExcelImportValidationSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<ExcelImportRowStatus | "all">("all");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [importSummary, setImportSummary] = useState<AssetExcelImportSummaryDto | null>(null);

  const [branches, setBranches] = useState<Array<{ id: string; label: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; label: string }>>([]);
  const [types, setTypes] = useState<Array<{ id: string; label: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    void (async () => {
      const [branchOpts, deptOpts, empOpts, catRes, typeRows] = await Promise.all([
        listBranchOptions().catch(() => []),
        listDepartmentOptions().catch(() => []),
        listEmployeeOptions().catch(() => []),
        assetCategoryService
          .search({ page: 1, page_size: 200, status: "active" })
          .catch(() => ({ items: [] })),
        listItAssetTypes({ active: true }).catch(() => []),
      ]);
      setBranches(branchOpts);
      setDepartments(deptOpts);
      setEmployees(empOpts);
      setTypes(typeRows.map((t) => ({ id: t.id, label: t.name })));
      const first = filterActiveCategories(catRes.items)[0];
      if (first) setDefaultCategoryId(first.id);
    })();
  }, []);

  const lookups = useMemo(
    () =>
      buildMasterLookups({
        branches,
        departments,
        types,
        employees,
      }),
    [branches, departments, employees, types],
  );

  const importEnabled = useMemo(() => {
    if (!validation || !defaultCategoryId) return false;
    const hasValid = validation.validCount > 0;
    const hasWarningImport = confirmWarnings && validation.warningCount > 0;
    return hasValid || hasWarningImport;
  }, [confirmWarnings, defaultCategoryId, validation]);

  const reset = useCallback(() => {
    setStep("select");
    setBusy(false);
    setFatalError(null);
    setParse(null);
    setMapping({});
    setTemplate(null);
    setValidation(null);
    setPreviewFilter("all");
    setConfirmWarnings(false);
    setImportSummary(null);
  }, []);

  const onFileSelected = useCallback(async (file: File) => {
    setBusy(true);
    setFatalError(null);
    setValidation(null);
    setImportSummary(null);
    setStep("parse");
    try {
      const parsed = await parseImportWorkbook(file);
      setParse(parsed);
      const suggested = suggestColumnMapping(parsed.sheet.headers);
      setMapping(suggested);
      const templateResult = runTemplateValidation(parsed.sheet, suggested);
      setTemplate(templateResult);
      setStep("template");
    } catch (err) {
      setFatalError(
        err instanceof ExcelImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to parse file",
      );
      setStep("select");
    } finally {
      setBusy(false);
    }
  }, []);

  const onMappingChange = useCallback((field: ExcelImportFieldKey, header: string | null) => {
    setMapping((prev) => ({ ...prev, [field]: header }));
  }, []);

  const onConfirmMapping = useCallback(() => {
    if (!parse) return;
    if (step === "template") {
      setStep("mapping");
      return;
    }
    setBusy(true);
    setFatalError(null);
    try {
      const templateResult = runTemplateValidation(parse.sheet, mapping);
      setTemplate(templateResult);
      if (!templateResult.ok) {
        setStep("mapping");
        setFatalError(
          templateResult.issues.find((i) => i.severity === "error")?.message ??
            "Template validation failed",
        );
        return;
      }
      setStep("validate");
      const summary = runRowValidation(parse.sheet, mapping, lookups);
      setValidation(summary);
      setStep("preview");
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : "Validation failed");
      setStep("mapping");
    } finally {
      setBusy(false);
    }
  }, [lookups, mapping, parse, step]);

  const onImport = useCallback(async () => {
    if (!validation || !defaultCategoryId) return;
    setBusy(true);
    setFatalError(null);
    try {
      const rows = buildImportPayloadRows(validation.previewRows, lookups, {
        includeWarnings: confirmWarnings,
      });
      if (!rows.length) {
        setFatalError("No importable rows after preview filters");
        return;
      }
      const summary = await executeExcelImport({
        confirm_warnings: confirmWarnings,
        batch_size: 50,
        defaults: {
          asset_category_id: defaultCategoryId,
          asset_type: "fixed",
          purchase_cost: "0",
          currency_code: "USD",
        },
        rows,
      });
      setImportSummary(summary);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }, [confirmWarnings, defaultCategoryId, lookups, validation]);

  return (
    <ExcelImportPage
      step={step}
      busy={busy}
      fatalError={fatalError}
      fileName={parse?.fileName ?? null}
      headers={parse?.sheet.headers ?? []}
      mapping={mapping}
      template={template}
      validation={validation}
      previewFilter={previewFilter}
      onPreviewFilterChange={setPreviewFilter}
      onFileSelected={(file) => void onFileSelected(file)}
      onMappingChange={onMappingChange}
      onConfirmMapping={onConfirmMapping}
      onBackToMapping={() => setStep("mapping")}
      onReset={reset}
      confirmWarnings={confirmWarnings}
      onConfirmWarningsChange={setConfirmWarnings}
      importEnabled={importEnabled}
      onImport={() => void onImport()}
      importSummary={importSummary}
    />
  );
}
