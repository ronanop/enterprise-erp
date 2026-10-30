"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { InvitationChannel, OnboardingCase } from "@/types/onboarding-management";

type Props = {
  open: boolean;
  caseRow: OnboardingCase | null;
  onClose: () => void;
  onSend: (caseId: string, channel: InvitationChannel, expiryDays: number) => void;
};

export function InvitationDrawer({ open, caseRow, onClose, onSend }: Props) {
  const [expiryDays, setExpiryDays] = useState("14");
  const [sending, setSending] = useState(false);

  if (!caseRow) return null;

  const rejectedDocs = caseRow.portal.documents.filter((d) => d.verifyStatus === "rejected");
  const isReupload = rejectedDocs.length > 0;
  const hasSent = Boolean(caseRow.invitation?.sentAt);

  async function handleSend() {
    setSending(true);
    try {
      await Promise.resolve(onSend(caseRow.id, "email", Number(expiryDays) || 14));
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title={isReupload ? "Resend invitation — re-upload" : "Onboarding invitation"}
      description={
        isReupload
          ? `Email ${caseRow.candidateName} a fresh portal link and login so they can re-upload rejected documents.`
          : `Email ${caseRow.candidateName} the onboarding portal link and login credentials.`
      }
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={sending}
            onClick={() => void handleSend()}
          >
            <Mail className="size-3.5" />
            {sending ? "Sending…" : hasSent ? "Resend invitation" : "Send invitation"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">{caseRow.caseCode}</p>
          <p className="mt-1 text-muted-foreground">
            Candidate: {caseRow.candidateName} · {caseRow.candidateEmail || "no email"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Join {caseRow.joiningDate || "-"}
          </p>
          {isReupload ? (
            <p className="mt-2 text-amber-800">
              Rejected:{" "}
              {rejectedDocs.map((d) => d.fileName).filter(Boolean).join(", ") || "document(s)"}.
              Candidate must sign in and re-upload under Documents.
            </p>
          ) : null}
          {hasSent ? (
            <p className="mt-2 text-muted-foreground">
              Last sent {new Date(caseRow.invitation!.sentAt).toLocaleString()} · Resends:{" "}
              {caseRow.invitation!.resendCount}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Login email and password are sent only by email — they are not shown in this screen.
        </p>

        <SetupField label="Link expiry (days)">
          <SetupInput
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
