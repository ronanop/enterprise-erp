"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Pencil, Save } from "lucide-react";

import {
  EmsAvatar,
  EmsFormGrid,
  EmsSkeleton,
  EmsTabBar,
  EmsTimeline,
} from "@/components/hr/workforce/ems-primitives";
import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getEmployeeById,
  listActivity,
  listAudit,
  loadEmployeeDirectory,
  updateEmployeeRecord,
} from "@/services/employee-management-service";
import type { EmployeeRecord, EmployeeWizardDraft } from "@/types/employee-management";
import { loadHrOverview } from "@/services/hr-service";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "employment", label: "Employment" },
  { id: "gov", label: "Government IDs" },
  { id: "bank", label: "Bank" },
  { id: "documents", label: "Documents" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "performance", label: "Performance" },
  { id: "training", label: "Training" },
  { id: "payroll", label: "Payroll" },
  { id: "assets", label: "Assets" },
  { id: "separation", label: "Separation" },
  { id: "activity", label: "Activity log" },
  { id: "audit", label: "Audit log" },
];

export function EmployeeProfilePage({ employeeId }: { employeeId: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "overview";
  const editMode = searchParams.get("edit") === "1";

  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);
  const [editOpen, setEditOpen] = useState(editMode);
  const [draft, setDraft] = useState<EmployeeWizardDraft | null>(null);
  const [hrCounts, setHrCounts] = useState({ attendance: 0, leave: 0, training: 0, separation: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { records } = await loadEmployeeDirectory();
      const found = getEmployeeById(records, employeeId) ?? null;
      setRecord(found);
      if (found) {
        setDraft({
          personal: found.extension.personal,
          employment: found.extension.employment,
          governmentIds: found.extension.governmentIds,
          bank: found.extension.bank,
          salary: found.extension.salary,
          documents: found.extension.documents,
        });
      }
      const hr = await loadHrOverview();
      const eid = employeeId;
      setHrCounts({
        attendance: hr.attendance.filter((r) => String(r.employee_id) === eid).length,
        leave: hr.leaveRequests.filter((r) => String(r.employee_id) === eid).length,
        training: hr.training.filter((r) => String(r.employee_id) === eid).length,
        separation: hr.separation.filter((r) => String(r.employee_id) === eid).length,
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const activity = useMemo(() => listActivity(employeeId), [employeeId, record]);
  const audit = useMemo(() => listAudit(employeeId), [employeeId, record]);

  async function saveEdit() {
    if (!record || !draft) return;
    try {
      await updateEmployeeRecord(record, draft);
      toast("Employee updated", "success");
      setEditOpen(false);
      void load();
    } catch {
      toast("Update failed", "error");
    }
  }

  if (loading && !record) return <EmsSkeleton rows={8} />;

  if (!record) {
    return (
      <HrEmptyState
        title="Employee not found"
        description="This profile may have been archived or you lack access."
        action={
          <Link href="/hr/workforce">
            <Button size="sm" className="cursor-pointer">
              Back to directory
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title={record.displayName}
        description={`${record.employeeCode} · ${record.designationName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hr/workforce">
              <Button variant="outline" size="sm" className="cursor-pointer">
                <ArrowLeft className="size-3.5" />
                Directory
              </Button>
            </Link>
            <Button size="sm" className="cursor-pointer" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-start">
        <EmsAvatar name={record.displayName} photoUrl={record.profilePhotoDataUrl} size="lg" />
        <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Info label="Employee ID" value={record.employeeCode} />
          <Info label="Department" value={record.departmentName} />
          <Info label="Designation" value={record.designationName} />
          <Info label="Manager" value={record.reportingManagerName} />
          <Info label="Branch" value={record.branchName} />
          <Info label="Joined" value={record.joiningDate || "—"} />
          <Info label="Employment type" value={record.employmentType} />
          <Info label="Status" value={<HrStatusBadge status={record.lifecycleStatus} />} />
          <Info label="Email" value={record.officialEmail} />
          <Info label="Phone" value={record.mobile} />
        </div>
      </div>

      <EmsTabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm min-h-[200px]">
        {tab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <Section title="Personal">
              <p>{record.extension.personal.maritalStatus || "—"} · {record.extension.personal.gender || "—"}</p>
              <p className="text-xs text-muted-foreground">{record.extension.personal.currentAddress.city}, {record.extension.personal.currentAddress.country}</p>
            </Section>
            <Section title="Emergency">
              <p>{record.extension.personal.emergency.name || "—"}</p>
              <p className="text-xs text-muted-foreground">{record.extension.personal.emergency.phone}</p>
            </Section>
            <Section title="Audit meta">
              <p className="text-xs text-muted-foreground">Created by {record.extension.createdBy}</p>
              <p className="text-xs text-muted-foreground">Updated by {record.extension.updatedBy} · {new Date(record.extension.updatedAt).toLocaleString()}</p>
            </Section>
          </div>
        ) : null}

        {tab === "employment" ? (
          <EmsFormGrid>
            <Info label="Grade" value={record.extension.employment.grade || "—"} />
            <Info label="Job level" value={record.extension.employment.jobLevel || "—"} />
            <Info label="Shift" value={record.extension.employment.shiftName || "—"} />
            <Info label="Location" value={record.extension.employment.location || "—"} />
            <Info label="Probation days" value={record.extension.employment.probationPeriodDays || "—"} />
            <Info label="Confirmation" value={record.extension.employment.confirmationDate || "—"} />
          </EmsFormGrid>
        ) : null}

        {tab === "gov" ? (
          <EmsFormGrid>
            {Object.entries(record.extension.governmentIds).map(([k, v]) =>
              typeof v === "string" && v ? (
                <Info key={k} label={k} value={v} />
              ) : null,
            )}
          </EmsFormGrid>
        ) : null}

        {tab === "bank" ? (
          <EmsFormGrid>
            <Info label="Bank" value={record.extension.bank.bankName || "—"} />
            <Info label="IFSC" value={record.extension.bank.ifsc || "—"} />
            <Info label="Account" value={record.extension.bank.accountNumber ? "••••" + record.extension.bank.accountNumber.slice(-4) : "—"} />
            <Info label="UPI" value={record.extension.bank.upiId || "—"} />
          </EmsFormGrid>
        ) : null}

        {tab === "documents" ? (
          <DocumentsTab record={record} />
        ) : null}

        {tab === "attendance" ? (
          <LinkedModuleHint count={hrCounts.attendance} href="/hr/time" label="attendance records" />
        ) : null}
        {tab === "leave" ? (
          <LinkedModuleHint count={hrCounts.leave} href="/hr/leave" label="leave requests" />
        ) : null}
        {tab === "performance" ? (
          <LinkedModuleHint count={0} href="/hr/talent" label="performance reviews" />
        ) : null}
        {tab === "training" ? (
          <LinkedModuleHint count={hrCounts.training} href="/hr/learning" label="training enrollments" />
        ) : null}
        {tab === "payroll" ? (
          <Section title="Salary snapshot">
            <p>CTC: {record.extension.salary.ctc || "—"}</p>
            <p className="text-xs text-muted-foreground">Payroll group: {record.extension.salary.payrollGroup || "—"}</p>
            <Link href="/hr/payroll" className="text-xs text-primary cursor-pointer hover:underline">Open payroll hub</Link>
          </Section>
        ) : null}
        {tab === "assets" ? (
          <p className="text-xs text-muted-foreground">Asset assignments will appear here when the assets module is linked.</p>
        ) : null}
        {tab === "separation" ? (
          <LinkedModuleHint count={hrCounts.separation} href="/hr/separation" label="separation cases" />
        ) : null}

        {tab === "activity" ? (
          <EmsTimeline
            items={activity.map((a) => ({
              title: a.title,
              detail: a.detail,
              at: a.at,
              actor: a.actor,
            }))}
          />
        ) : null}

        {tab === "audit" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="py-2 pr-2">Field</th>
                  <th className="py-2 pr-2">Old</th>
                  <th className="py-2 pr-2">New</th>
                  <th className="py-2 pr-2">By</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-medium">{row.field}</td>
                    <td className="py-2 pr-2 max-w-[8rem] truncate text-muted-foreground">{row.oldValue.slice(0, 80)}</td>
                    <td className="py-2 pr-2 max-w-[8rem] truncate">{row.newValue.slice(0, 80)}</td>
                    <td className="py-2 pr-2">{row.changedBy}</td>
                    <td className="py-2">{new Date(row.changedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <SetupDrawer
        open={editOpen}
        title="Edit employee"
        description="Changes sync to master employee and HR profile where APIs allow."
        wide
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="cursor-pointer" onClick={() => void saveEdit()}>
              <Save className="size-3.5" />
              Save changes
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <EmsFormGrid>
              <SetupField label="First name">
                <SetupInput
                  value={draft.personal.firstName}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, firstName: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Last name">
                <SetupInput
                  value={draft.personal.lastName}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, lastName: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Official email">
                <SetupInput
                  value={draft.personal.officialEmail}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, officialEmail: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Mobile">
                <SetupInput
                  value={draft.personal.mobile}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, mobile: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Designation">
                <SetupInput
                  value={draft.employment.designationName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      employment: { ...draft.employment, designationName: e.target.value },
                    })
                  }
                />
              </SetupField>
              <SetupField label="Status">
                <SetupSelect
                  value={draft.employment.lifecycleStatus}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      employment: {
                        ...draft.employment,
                        lifecycleStatus: e.target.value as typeof draft.employment.lifecycleStatus,
                      },
                    })
                  }
                >
                  {["active", "inactive", "probation", "notice", "resigned", "archived"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </SetupSelect>
              </SetupField>
            </EmsFormGrid>
          </div>
        ) : null}
      </SetupDrawer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function LinkedModuleHint({ count, href, label }: { count: number; href: string; label: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {count} {label} linked to this employee.{" "}
      <Link href={href} className="cursor-pointer font-medium text-primary hover:underline">
        Open module
      </Link>
    </p>
  );
}

function DocumentsTab({ record }: { record: EmployeeRecord }) {
  const docs = record.extension.documents;
  if (!docs.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No documents in local profile store. Upload during create or via HR employee-documents API.
      </p>
    );
  }
  return (
    <ul className="space-y-2 text-xs">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
          <div>
            <p className="font-medium">{d.documentType}</p>
            <p className="text-muted-foreground">{d.fileName} · {d.uploadedBy} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
            {d.expiryDate ? (
              <p className="text-amber-700">Expires {d.expiryDate}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {d.fileDataUrl ? (
              <a href={d.fileDataUrl} download={d.fileName} className="cursor-pointer text-primary hover:underline">
                <Download className="inline size-3.5" /> Download
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
