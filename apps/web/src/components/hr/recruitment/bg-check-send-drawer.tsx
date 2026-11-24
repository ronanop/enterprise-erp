"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type {
  AtsCandidate,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { fetchBgPortalStatus } from "@/services/bg-check-portal-service";

export type BgCheckSendPayload = {
  applicationId: string;
  toAddress: string;
  subject: string;
  /** Plain-text body (HR-editable); parent appends portal credentials. */
  bodyText: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  application: PipelineApplication | null;
  candidate: AtsCandidate | null;
  job: JobOpening | null;
  onSend: (payload: BgCheckSendPayload) => Promise<void>;
};

function defaultBody(opts: {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  role: string;
  department: string;
  applicationCode: string;
  documentCount: number;
}): string {
  return [
    `Dear Background Verification Partner,`,
    ``,
    `Please initiate a background check for the following candidate:`,
    ``,
    `Name: ${opts.candidateName}`,
    `Email: ${opts.candidateEmail}`,
    `Phone: ${opts.candidatePhone}`,
    `Role: ${opts.role}`,
    `Department: ${opts.department}`,
    `Application: ${opts.applicationCode}`,
    opts.documentCount > 0
      ? `Documents on file: ${opts.documentCount} (download via the secure link below)`
      : `Documents: candidate portal may still be pending — contact HR if files are missing`,
    ``,
    `A secure download link with login credentials is included at the end of this email.`,
    ``,
    `Kindly confirm receipt and share the verification report when ready.`,
    ``,
    `Regards,`,
    `HR Team`,
  ].join("\n");
}

export function BgCheckSendDrawer({
  open,
  onClose,
  application,
  candidate,
  job,
  onSend,
}: Props) {
  const [toAddress, setToAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!open || !candidate || !application) return;
    const role = job?.title || "Role";
    setToAddress("");
    setSubject(`Background verification request — ${candidate.fullName} (${role})`);
    setDocCount(0);
    setPortalLoading(true);
    void fetchBgPortalStatus(application.id)
      .then((status) => {
        const count = status?.document_count ?? 0;
        setDocCount(count);
        setNotes(
          defaultBody({
            candidateName: candidate.fullName,
            candidateEmail: candidate.email || "",
            candidatePhone: candidate.phone || "",
            role,
            department: job?.department || "",
            applicationCode: application.applicationCode,
            documentCount: count,
          }),
        );
      })
      .catch(() => {
        setNotes(
          defaultBody({
            candidateName: candidate.fullName,
            candidateEmail: candidate.email || "",
            candidatePhone: candidate.phone || "",
            role,
            department: job?.department || "",
            applicationCode: application.applicationCode,
            documentCount: 0,
          }),
        );
      })
      .finally(() => setPortalLoading(false));
  }, [open, candidate, application, job]);

  if (!application || !candidate) return null;

  async function handleSend() {
    const to = toAddress.trim();
    if (!to || !notes.trim()) return;
    setSaving(true);
    try {
      await onSend({
        applicationId: application.id,
        toAddress: to,
        subject: subject.trim() || `Background verification — ${candidate.fullName}`,
        bodyText: notes.trim(),
        candidateName: candidate.fullName,
        candidateEmail: candidate.email || "",
        candidatePhone: candidate.phone || "",
      });
      onClose();
    } catch {
      // Parent surfaces the toast; keep drawer open so the user can retry.
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Send background check"
      description="Email your BG partner a secure download link with login credentials. The link expires in 24 hours. No large file attachments."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving || !toAddress.trim() || !notes.trim()}
            onClick={() => void handleSend()}
          >
            {saving ? "Sending…" : "Send BG check email"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
          <p className="font-medium">{candidate.fullName}</p>
          <p className="mt-0.5 text-muted-foreground">
            {job?.title || "Role"} · {candidate.email || "—"} · {candidate.phone || "—"}
          </p>
        </div>

        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
              {portalLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#111827]">
                Secure download link
              </p>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">
                Partner will receive a portal URL, their email, and a one-time access
                code. Link expires in 24 hours.{" "}
                {portalLoading
                  ? "Checking documents…"
                  : docCount > 0
                    ? `${docCount} portal document(s) available for download.`
                    : "No portal documents yet — partner can still open the link once files are submitted."}
              </p>
            </div>
          </div>
        </div>

        <SetupField label="Partner / vendor email" required>
          <SetupInput
            type="email"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="bg-partner@example.com"
            autoFocus
          />
        </SetupField>
        <SetupField label="Subject" required>
          <SetupInput value={subject} onChange={(e) => setSubject(e.target.value)} />
        </SetupField>
        <SetupField label="Message / candidate details" required>
          <SetupTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={12}
            placeholder="Candidate details for verification…"
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
