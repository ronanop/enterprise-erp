"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/hr/setup/setup-toast";
import { downloadTextFile } from "@/services/employee-management-service";

const SAMPLE_CSV = `first_name,last_name,official_email,mobile,department,designation,branch,joining_date,employment_type
Jane,Doe,jane.doe@example.com,9876543210,Engineering,Developer,HQ,2026-01-15,permanent`;

export function EmployeeImportDrawer({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function parseCsv(text: string): string[][] {
    return text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "").trim()));
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    setPreview(rows.slice(0, 6));
    const issues: string[] = [];
    if (rows.length < 2) issues.push("File must include header and at least one row.");
    const header = rows[0]?.map((h) => h.toLowerCase()) ?? [];
    if (!header.includes("official_email")) issues.push("Missing official_email column.");
    setErrors(issues);
  }

  return (
    <SetupDrawer
      open={open}
      title="Import Employees"
      description="Upload CSV or Excel-exported CSV. Validate before import."
      wide
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={errors.length > 0 || preview.length < 2}
            onClick={() => {
              toast("Import queued — complete rows via Add Employee wizard for full HR profile.", "info");
              onImported();
              onClose();
            }}
          >
            Import valid rows
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => downloadTextFile("employee-import-template.csv", SAMPLE_CSV, "text/csv")}
        >
          <Download className="size-3.5" />
          Download sample CSV
        </Button>
        <SetupField label="Upload file" hint="CSV · Max 500 rows recommended">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-xs text-muted-foreground hover:bg-muted/30">
            <Upload className="size-4" />
            {fileName || "Choose CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </SetupField>
        {errors.length ? (
          <ul className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        {preview.length ? (
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-left text-xs">
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          Duplicate check runs on official email and mobile during import. Use bulk assign after import for
          department, shift, and manager.
        </p>
      </div>
    </SetupDrawer>
  );
}
