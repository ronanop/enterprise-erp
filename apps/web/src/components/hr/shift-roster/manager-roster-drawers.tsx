"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  applyManagerRosterImport,
  downloadTextFile,
  exportManagerRosterCsv,
  validateManagerRosterCsv,
  type ManagerRosterValidation,
  type ShiftRosterDirectory,
} from "@/services/shift-roster-service";
import { downloadManagerRosterXlsx } from "@/lib/roster-xlsx-export";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DownloadManagerRosterDrawer({
  open,
  onClose,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  directory: ShiftRosterDirectory | null;
}) {
  const managers = directory?.options.managers ?? [];
  const [managerId, setManagerId] = useState("");
  const [month, setMonth] = useState(currentMonth);

  useEffect(() => {
    if (!open) return;
    setMonth(currentMonth());
    setManagerId((prev) => {
      if (prev && managers.some((m) => m.id === prev)) return prev;
      return managers[0]?.id ?? "";
    });
  }, [open, managers]);

  const teamCount = useMemo(() => {
    if (!directory || !managerId) return 0;
    return directory.options.employees.filter((e) => e.managerId === managerId).length;
  }, [directory, managerId]);

  const [downloading, setDownloading] = useState(false);

  function download() {
    if (!directory) return;
    if (!managerId) {
      toast("Select a manager", "error");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast("Month must be YYYY-MM", "error");
      return;
    }
    setDownloading(true);
    void downloadManagerRosterXlsx(directory, managerId, month)
      .then(({ teamCount: n }) => {
        toast(`Downloaded Excel roster for ${n} employees`, "success");
        onClose();
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "Download failed", "error");
      })
      .finally(() => setDownloading(false));
  }

  return (
    <SetupDrawer
      open={open}
      title="Download manager roster"
      description="Sheet columns: employee code, name, and real calendar dates only. Manager is chosen here before download."
      onClose={onClose}
      footer={
        <>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={onClose}
            disabled={downloading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={!managerId || teamCount === 0 || downloading}
            onClick={() => {
              if (!directory) return;
              try {
                const { filename, csv, teamCount: n } = exportManagerRosterCsv(
                  directory,
                  managerId,
                  month,
                );
                downloadTextFile(filename, csv, "text/csv");
                toast(`Downloaded plain CSV for ${n} employees`, "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "CSV failed", "error");
              }
            }}
          >
            Plain CSV
          </Button>
          <Button
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={download}
            disabled={!managerId || teamCount === 0 || downloading}
          >
            <Download className="size-3.5" />
            {downloading ? "Building…" : "Download Excel"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Reporting manager" required hint="Only reporting managers with direct reports are listed">
          <SetupSelect value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {m.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Month" required hint="Format YYYY-MM">
          <SetupInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </SetupField>
        <p className="text-xs text-muted-foreground">
          {managerId
            ? teamCount
              ? `${teamCount} employee(s) for ${month || "selected month"}. Fill day cells with shift codes (A/B/C/D…), WO, or HO.`
              : "No employees report to this manager."
            : "Pick a manager to see team size."}
        </p>
        {directory && directory.shifts.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Shift codes (use these in cells)</p>
            <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
              {directory.shifts
                .filter((s) => s.status !== "inactive")
                .map((s) => (
                  <li key={s.id}>
                    <span className="font-semibold text-foreground">{s.shiftCode}</span>
                    {" — "}
                    {s.shiftName}
                  </li>
                ))}
            </ul>
            <p className="mt-2">Also: <strong>WO</strong> weekly off · <strong>HO</strong> holiday</p>
          </div>
        ) : null}
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Sheet layout</p>
          <p className="mt-1">
            Columns are <strong>employee_code</strong>, <strong>employee_name</strong>, then real
            dates (e.g. <strong>2026-08-11 (Mon)</strong>). Day cells use conditional formatting so
            colors update when you change shift / WO / HO via the dropdown. CSV has the same values
            without colors.
          </p>
        </div>
      </div>
    </SetupDrawer>
  );
}

export function UploadManagerRosterDrawer({
  open,
  onClose,
  onApplied,
  directory,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
  directory: ShiftRosterDirectory | null;
}) {
  const managers = directory?.options.managers ?? [];
  const [managerId, setManagerId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<ManagerRosterValidation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMonth(currentMonth());
    setManagerId((prev) => {
      if (prev && managers.some((m) => m.id === prev)) return prev;
      return managers[0]?.id ?? "";
    });
  }, [open, managers]);

  function reset() {
    setFileName("");
    setRaw("");
    setValidation(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRaw(text);
    setValidation(null);
  }

  function validate() {
    if (!directory) return;
    if (!managerId) {
      toast("Select a reporting manager", "error");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast("Month must be YYYY-MM", "error");
      return;
    }
    if (!raw.trim()) {
      toast("Choose a CSV file first", "error");
      return;
    }
    const result = validateManagerRosterCsv(directory, raw, { managerId, month });
    setValidation(result);
    if (result.errors.length && result.ok === 0) {
      toast("Validation failed — see errors", "error");
    } else if (result.errors.length) {
      toast(`Validated with ${result.errors.length} warning(s)`, "info");
    } else {
      toast(`Ready to apply ${result.ok} cells`, "success");
    }
  }

  async function apply() {
    if (!validation) {
      toast("Validate the file first", "error");
      return;
    }
    if (validation.ok === 0 && validation.cleared === 0) {
      toast("Nothing to apply", "error");
      return;
    }
    setBusy(true);
    try {
      await applyManagerRosterImport(validation);
      toast(`Roster updated for ${validation.managerCode} (${validation.month})`, "success");
      reset();
      onApplied();
      onClose();
    } catch {
      toast("Apply failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      title="Upload manager roster"
      description="Select the same manager and month used on download, then upload the filled CSV."
      onClose={handleClose}
      wide
      footer={
        <>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={handleClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={validate}
            disabled={!raw || !managerId || busy}
          >
            Validate
          </Button>
          <Button
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void apply()}
            disabled={!validation || busy || (validation.ok === 0 && validation.cleared === 0)}
          >
            <Upload className="size-3.5" />
            {busy ? "Applying…" : "Apply to calendar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Reporting manager" required hint="Must match the team in the CSV">
          <SetupSelect value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {m.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Month" required hint="Format YYYY-MM">
          <SetupInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </SetupField>
        <SetupField
          label="Roster CSV"
          required
          hint="Columns: employee_code, employee_name, then date headers"
        >
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full cursor-pointer text-xs"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {fileName ? (
            <p className="mt-1 text-xs text-muted-foreground">Selected: {fileName}</p>
          ) : null}
        </SetupField>

        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Allowed cell values: shift <strong>codes</strong> from Shift master (e.g. A/B/C/D),{" "}
          <strong>WO</strong> (weekly off), <strong>HO</strong> (holiday), or blank (clear
          override). Day columns: full dates like <strong>2026-08-11 (Mon)</strong> (legacy{" "}
          <strong>d01…d31</strong> headers still import). Older CSVs that still include
          manager/month/department columns are accepted.
        </div>

        {directory && directory.shifts.length > 0 ? (
          <div className="rounded-lg border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Known shifts</p>
            <p className="mt-1">
              {directory.shifts
                .filter((s) => s.status !== "inactive")
                .map((s) => `${s.shiftCode} (${s.shiftName})`)
                .join(" · ")}
            </p>
          </div>
        ) : null}

        {validation ? (
          <div className="space-y-2 rounded-lg border border-border/70 p-3 text-xs">
            <p>
              <span className="font-medium">Reporting manager:</span> {validation.managerCode} ·{" "}
              {validation.managerName}
            </p>
            <p>
              <span className="font-medium">Month:</span> {validation.month || "—"}
            </p>
            <p>
              <span className="font-medium text-emerald-700">{validation.ok}</span> cells to write ·{" "}
              <span className="font-medium">{validation.cleared}</span> clears ·{" "}
              <span className="font-medium text-destructive">{validation.errors.length}</span> errors
            </p>
            {validation.errors.length ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-destructive">
                {validation.errors.slice(0, 40).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {validation.errors.length > 40 ? (
                  <li>…and {validation.errors.length - 40} more</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-emerald-700">Validation passed. Ready to apply.</p>
            )}
          </div>
        ) : null}
      </div>
    </SetupDrawer>
  );
}
