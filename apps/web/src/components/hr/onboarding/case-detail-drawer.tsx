"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, UserCheck } from "lucide-react";

import {
  OnboardingDocumentPreviewDialog,
  OnboardingDocumentRow,
} from "@/components/hr/onboarding/onboarding-document-preview";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { getInvitationUrl } from "@/services/onboarding-management-service";
import type {
  ChecklistItem,
  OnboardingCase,
  OnboardingDocument,
} from "@/types/onboarding-management";
import { PORTAL_STEPS } from "@/types/onboarding-management";
import { resolveOnboardingDisplayStatus } from "@/lib/onboarding-display-status";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  caseRow: OnboardingCase | null;
  onClose: () => void;
  onChecklist: (caseId: string, itemId: string, status: ChecklistItem["status"]) => void;
  onVerifyDoc: (
    caseId: string,
    docId: string,
    status: OnboardingDocument["verifyStatus"],
  ) => void;
  onApprove: (caseId: string) => void;
  onComplete: (caseId: string) => void;
  onInvite: (caseRow: OnboardingCase) => void;
};

export function CaseDetailDrawer({
  open,
  caseRow,
  onClose,
  onChecklist,
  onVerifyDoc,
  onApprove,
  onComplete,
  onInvite,
}: Props) {
  const [tab, setTab] = useState<"overview" | "portal" | "docs" | "checklist" | "timeline">(
    "overview",
  );
  const [note, setNote] = useState("");
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);

  const timeline = useMemo(() => {
    if (!caseRow) return [];
    const items: { label: string; at?: string; done: boolean }[] = [
      { label: "Case created", at: caseRow.createdAt, done: true },
      {
        label: "Invitation sent",
        at: caseRow.invitation?.sentAt,
        done: Boolean(caseRow.invitation?.sentAt),
      },
      {
        label: "Portal in progress",
        done: ["in_progress", "submitted", "hr_review", "ready_to_join", "joined"].includes(
          caseRow.status,
        ),
      },
      {
        label: "Candidate submitted",
        at: caseRow.portal.submittedAt,
        done: Boolean(caseRow.portal.submittedAt),
      },
      {
        label: "HR verified",
        done: ["ready_to_join", "joined"].includes(caseRow.status),
      },
      {
        label: "Employee created",
        at: caseRow.activatedAt,
        done: caseRow.status === "joined",
      },
    ];
    return items;
  }, [caseRow]);

  if (!caseRow) return null;

  const hrTasks = caseRow.checklist.filter((t) => t.owner === "hr");
  const mgrTasks = caseRow.checklist.filter((t) => t.owner === "manager");
  const showChecklist = caseRow.status === "joined" && caseRow.checklist.length > 0;
  const canApprove = caseRow.status === "hr_review" && Boolean(caseRow.portal.submittedAt);
  const canComplete = ["hr_review", "ready_to_join"].includes(caseRow.status);

  const tabs = (
    [
      ["overview", "Overview"],
      ["portal", "Portal"],
      ["docs", "Documents"],
      ...(showChecklist ? [["checklist", "Checklist"] as const] : []),
      ["timeline", "Timeline"],
    ] as const
  );

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={caseRow.candidateName}
      description={`${caseRow.caseCode} · ${resolveOnboardingDisplayStatus(caseRow.status, caseRow.joiningDate)} · ${caseRow.progressPct}%`}
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onInvite(caseRow)}
          >
            Invitation
          </Button>
          {canApprove ? (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => onApprove(caseRow.id)}
            >
              Approve submission
            </Button>
          ) : null}
          {canComplete && caseRow.status !== "joined" ? (
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => onComplete(caseRow.id)}
            >
              <UserCheck className="size-3.5" />
              Complete onboarding
            </Button>
          ) : null}
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Joining" value={caseRow.joiningDate} />
            <Info label="Department" value={caseRow.department} />
            <Info label="Designation" value={caseRow.designation} />
            <Info label="Reporting manager" value={caseRow.reportingManager || "—"} />
            <Info label="Branch" value={caseRow.branch} />
            <Info label="HR owner" value={caseRow.hrOwner} />
            <Info label="Employee ID" value={caseRow.employeeId || "Assigned after completion"} />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Status</p>
              <HrStatusBadge status={resolveOnboardingDisplayStatus(caseRow.status, caseRow.joiningDate)} />
            </div>
          </div>
          {caseRow.status !== "joined" ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              After verification, complete onboarding to create the employee record. Assign shift,
              leave policy, and other details from Workforce once the employee is active.
            </p>
          ) : null}
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${caseRow.progressPct}%` }}
            />
          </div>
          {caseRow.invitation?.token ? (
            <p className="break-all font-mono text-[10px] text-muted-foreground">
              Portal: {getInvitationUrl(caseRow.invitation.token)}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "portal" ? (
        <div className="space-y-2">
          {PORTAL_STEPS.map((s, i) => {
            const currentIdx = PORTAL_STEPS.findIndex((x) => x.id === caseRow.portal.currentStep);
            const done = caseRow.portal.submittedAt
              ? true
              : i < currentIdx || (i === currentIdx && caseRow.status !== "invitation_sent");
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                {done ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    Step {i + 1}. {s.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
            <p className="font-medium text-foreground">Personal snapshot</p>
            <p className="mt-1 text-muted-foreground">
              {caseRow.portal.personal.firstName} {caseRow.portal.personal.lastName} ·{" "}
              {caseRow.portal.personal.email || caseRow.candidateEmail}
            </p>
            <p className="text-muted-foreground">
              PAN {caseRow.portal.governmentIds.pan || "—"} · Aadhaar{" "}
              {caseRow.portal.governmentIds.aadhaar || "—"}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "docs" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Click the file name or View to open a preview (PDF and images).
          </p>
          {caseRow.portal.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            caseRow.portal.documents.map((d) => (
              <OnboardingDocumentRow
                key={d.id}
                doc={d}
                onView={setPreviewDoc}
                onVerify={() => onVerifyDoc(caseRow.id, d.id, "verified")}
                onReject={() => onVerifyDoc(caseRow.id, d.id, "rejected")}
              />
            ))
          )}
        </div>
      ) : null}

      <OnboardingDocumentPreviewDialog
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {tab === "checklist" && showChecklist ? (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Post-join tasks — complete assignment details in Workforce as each item is done.
          </p>
          <ChecklistGroup
            title="HR Tasks"
            items={hrTasks}
            onToggle={(id, status) => onChecklist(caseRow.id, id, status)}
          />
          <ChecklistGroup
            title="Manager Tasks"
            items={mgrTasks}
            onToggle={(id, status) => onChecklist(caseRow.id, id, status)}
          />
          <SetupField label="Notes">
            <SetupTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </SetupField>
        </div>
      ) : null}

      {tab === "timeline" ? (
        <ol className="space-y-3 border-l border-border pl-4">
          {timeline.map((t) => (
            <li key={t.label} className="relative text-xs">
              <span
                className={cn(
                  "absolute -left-[21px] top-0.5 size-2.5 rounded-full border-2 border-card",
                  t.done ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              <p className={cn("font-medium", t.done ? "text-foreground" : "text-muted-foreground")}>
                {t.label}
              </p>
              {t.at ? (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(t.at).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </SetupDrawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function ChecklistGroup({
  title,
  items,
  onToggle,
}: {
  title: string;
  items: ChecklistItem[];
  onToggle: (id: string, status: ChecklistItem["status"]) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs transition-colors hover:bg-muted/40"
          >
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={item.status === "done"}
              onChange={(e) => onToggle(item.id, e.target.checked ? "done" : "pending")}
            />
            <span className="flex-1">{item.name}</span>
            <HrStatusBadge status={item.status} />
          </label>
        ))}
      </div>
    </div>
  );
}
