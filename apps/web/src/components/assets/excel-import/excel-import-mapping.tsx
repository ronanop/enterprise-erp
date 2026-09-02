"use client";

import { getTargetFieldDefs } from "@/components/assets/excel-import/excel-import-mapper";
import type { ExcelImportColumnMapping, ExcelImportFieldKey } from "@/components/assets/excel-import/excel-import.types";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ExcelImportMappingPanelProps = {
  headers: string[];
  mapping: ExcelImportColumnMapping;
  onChange: (field: ExcelImportFieldKey, header: string | null) => void;
  className?: string;
};

export function ExcelImportMappingPanel({
  headers,
  mapping,
  onChange,
  className,
}: ExcelImportMappingPanelProps) {
  const fields = getTargetFieldDefs();

  return (
    <div className={cn("space-y-3", className)} data-testid="excel-import-mapping-panel">
      <p className="text-sm text-muted-foreground">
        Review how Excel headers map to ERP register fields. Required fields must be mapped.
      </p>
      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">ERP field</th>
              <th className="px-3 py-2">Required</th>
              <th className="px-3 py-2">Excel column</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium">{field.label}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {field.required ? "Yes" : "No"}
                </td>
                <td className="px-3 py-2">
                  <Label className="sr-only" htmlFor={`map-${field.key}`}>
                    Map {field.label}
                  </Label>
                  <select
                    id={`map-${field.key}`}
                    className="h-9 w-full max-w-xs cursor-pointer rounded-md border border-input bg-background px-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={mapping[field.key] ?? ""}
                    data-testid={`excel-import-map-${field.key}`}
                    onChange={(e) =>
                      onChange(field.key, e.target.value ? e.target.value : null)
                    }
                  >
                    <option value="">— Not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
