"use client";

import { useEffect, useState } from "react";

import { HrField, HrFormDialog, HrSelect } from "@/components/hr/hr-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createDesignation,
  listHrBranchOptions,
  type HrOption,
} from "@/services/hr-service";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function DesignationFormDialog({ open, onClose, onSaved }: Props) {
  const [branches, setBranches] = useState<HrOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void listHrBranchOptions().then((b) => {
      setBranches(b);
      if (b[0]) setBranchId((prev) => prev || b[0].id);
    });
  }, [open]);

  async function submit() {
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setSaving(true);
    try {
      await createDesignation({
        branch_id: branchId || null,
        designation_code: code.trim(),
        designation_name: name.trim(),
        job_level: jobLevel.trim() || undefined,
      });
      onSaved();
      onClose();
      setCode("");
      setName("");
      setJobLevel("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create designation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HrFormDialog
      open={open}
      title="Add Designation"
      description="Create a job designation master."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <HrField label="Branch (optional)">
          <HrSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Company-wide</option>
            {branches.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </HrSelect>
        </HrField>
        <HrField label="Job level">
          <Input
            value={jobLevel}
            onChange={(e) => setJobLevel(e.target.value)}
            placeholder="e.g. L2"
          />
        </HrField>
        <HrField label="Code">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DES-001" />
        </HrField>
        <HrField label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Software Engineer"
          />
        </HrField>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </HrFormDialog>
  );
}
