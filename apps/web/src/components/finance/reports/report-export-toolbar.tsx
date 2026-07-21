"use client";

import { Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onCsv?: () => void;
  onXlsx?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function ReportExportToolbar({
  onCsv,
  onXlsx,
  onPrint,
  onPdf,
  onRefresh,
  loading,
  disabled,
}: Props) {
  const off = disabled || loading;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onCsv ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          disabled={off}
          onClick={onCsv}
        >
          <Download className="size-3.5" /> CSV
        </Button>
      ) : null}
      {onXlsx ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          disabled={off}
          onClick={onXlsx}
        >
          <FileSpreadsheet className="size-3.5" /> XLSX
        </Button>
      ) : null}
      {onPrint ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          disabled={off}
          onClick={onPrint}
        >
          <Printer className="size-3.5" /> Print
        </Button>
      ) : null}
      {onPdf ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          disabled={off}
          onClick={onPdf}
        >
          <Printer className="size-3.5" /> PDF
        </Button>
      ) : null}
      {onRefresh ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      ) : null}
    </div>
  );
}
