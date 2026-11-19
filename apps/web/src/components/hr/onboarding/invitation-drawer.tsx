"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Phone } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { getInvitationUrl } from "@/services/onboarding-management-service";
import type { InvitationChannel, OnboardingCase } from "@/types/onboarding-management";

type Props = {
  open: boolean;
  caseRow: OnboardingCase | null;
  onClose: () => void;
  onSend: (caseId: string, channel: InvitationChannel, expiryDays: number) => void;
};

export function InvitationDrawer({ open, caseRow, onClose, onSend }: Props) {
  const [channel, setChannel] = useState<InvitationChannel>("email");
  const [expiryDays, setExpiryDays] = useState("14");
  const [copied, setCopied] = useState(false);

  if (!caseRow) return null;

  const token = caseRow.invitation?.token ?? "";
  const url = token ? getInvitationUrl(token) : "Save case first";

  function copy() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Onboarding Invitation"
      description={`Secure link for ${caseRow.candidateName}`}
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              onSend(caseRow.id, channel, Number(expiryDays) || 14);
              onClose();
            }}
          >
            {caseRow.invitation?.sentAt ? "Resend invitation" : "Send invitation"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">{caseRow.caseCode}</p>
          <p className="mt-1 text-muted-foreground">
            {caseRow.candidateEmail || "No email"} · Join {caseRow.joiningDate || "—"}
          </p>
          {caseRow.invitation?.sentAt ? (
            <p className="mt-2 text-amber-800">
              Last sent {new Date(caseRow.invitation.sentAt).toLocaleString()} via{" "}
              {caseRow.invitation.lastChannel ?? caseRow.invitation.channel} · Resends:{" "}
              {caseRow.invitation.resendCount}
            </p>
          ) : null}
        </div>

        <SetupField label="Secure link">
          <div className="flex gap-2">
            <SetupInput value={url} readOnly className="font-mono text-[11px]" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={copy}
            >
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </SetupField>

        <SetupField label="Channel">
          <SetupSelect
            value={channel}
            onChange={(e) => setChannel(e.target.value as InvitationChannel)}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </SetupSelect>
        </SetupField>

        <SetupField label="Link expiry (days)">
          <SetupInput
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </SetupField>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onSend(caseRow.id, "email", Number(expiryDays) || 14)}
          >
            <Mail className="size-3.5" />
            Send Email
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onSend(caseRow.id, "sms", Number(expiryDays) || 14)}
          >
            <Phone className="size-3.5" />
            Send SMS
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onSend(caseRow.id, "whatsapp", Number(expiryDays) || 14)}
          >
            <MessageCircle className="size-3.5" />
            Send WhatsApp
          </Button>
        </div>
      </div>
    </SetupDrawer>
  );
}
