"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  createExistingEmployee,
  loadEmployeeDirectory,
  previewNextEmployeeCode,
  type EmployeeDirectoryOptions,
} from "@/services/employee-management-service";

/** Epic 2 — lightweight Add Employee for existing / migrated staff (bypass onboarding). */
export default function NewEmployeePage() {
  const router = useRouter();
  const [options, setOptions] = useState<EmployeeDirectoryOptions | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    employeeCode: previewNextEmployeeCode(),
    joiningDate: new Date().toISOString().slice(0, 10),
    branchId: "",
    departmentId: "",
    designationName: "",
    employmentType: "permanent",
    reportingManagerId: "",
  });

  useEffect(() => {
    void loadEmployeeDirectory()
      .then(({ options: opts }) => {
        setOptions(opts);
        setForm((f) => ({
          ...f,
          branchId: f.branchId || opts.branches[0]?.id || "",
          departmentId: f.departmentId || opts.departments[0]?.id || "",
          designationName: f.designationName || opts.designations[0]?.label || "",
        }));
      })
      .catch(() => toast("Failed to load org options", "error"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast("First and last name are required", "error");
      return;
    }
    if (!form.email.trim() || !form.mobile.trim()) {
      toast("Official email and mobile are required", "error");
      return;
    }
    if (!form.branchId || !form.departmentId) {
      toast("Branch and department are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createExistingEmployee({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        employeeCode: form.employeeCode.trim() || undefined,
        joiningDate: form.joiningDate,
        branchId: form.branchId,
        departmentId: form.departmentId,
        designationName: form.designationName || "Staff",
        employmentType: form.employmentType,
        reportingManagerId: form.reportingManagerId || undefined,
      });
      toast(`Employee ${created.employeeCode} created`, "success");
      router.push(`/hr/workforce/${created.id}`);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Create failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Add employee"
        description="Light hire for existing staff or data migration. New hires should still use Recruitment → Onboarding."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hr/workforce">
              <Button size="sm" variant="ghost" className="cursor-pointer">
                <ArrowLeft className="size-3.5" />
                Directory
              </Button>
            </Link>
            <Link href="/hr/onboarding">
              <Button size="sm" variant="outline" className="cursor-pointer">
                Hire via onboarding
              </Button>
            </Link>
          </div>
        }
      />

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="max-w-3xl space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex items-start gap-3">
          <UserPlus className="mt-0.5 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Creates an active master employee with{" "}
            <code className="rounded bg-muted px-1 text-xs">bypass_onboarding</code> and an
            employment record marked payroll-eligible.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SetupField label="First name" required>
            <SetupInput
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </SetupField>
          <SetupField label="Last name" required>
            <SetupInput
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </SetupField>
          <SetupField label="Official email" required>
            <SetupInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </SetupField>
          <SetupField label="Mobile" required>
            <SetupInput
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </SetupField>
          <SetupField label="Employee code">
            <SetupInput
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
            />
          </SetupField>
          <SetupField label="Date of joining" required>
            <SetupInput
              type="date"
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
          </SetupField>
          <SetupField label="Branch" required>
            <SetupSelect
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="">Select branch</option>
              {(options?.branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Department" required>
            <SetupSelect
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Select department</option>
              {(options?.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Designation" required>
            <SetupSelect
              value={form.designationName}
              onChange={(e) => setForm({ ...form, designationName: e.target.value })}
            >
              <option value="">Select designation</option>
              {(options?.designations ?? []).map((d) => (
                <option key={d.id} value={d.label}>
                  {d.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Employment type">
            <SetupSelect
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            >
              <option value="permanent">Permanent</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="consultant">Consultant</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Reporting manager">
            <SetupSelect
              value={form.reportingManagerId}
              onChange={(e) => setForm({ ...form, reportingManagerId: e.target.value })}
            >
              <option value="">None</option>
              {(options?.managers ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" size="sm" className="cursor-pointer" disabled={submitting}>
            {submitting ? "Creating…" : "Create employee"}
          </Button>
          <Link href="/hr/workforce">
            <Button type="button" size="sm" variant="ghost" className="cursor-pointer">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
