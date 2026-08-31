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
import {
  copyInvitationCredentials,
  getPortalLoginUrl,
  invitationLoginEmail,
  invitationPortalPassword,
} from "@/services/onboarding-management-service";
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
  const [copied, setCopied] = useState<"link" | "creds" | null>(null);

  if (!caseRow) return null;

  const loginUrl = getPortalLoginUrl();
  const loginEmail = invitationLoginEmail(caseRow);
  const portalPassword = invitationPortalPassword(caseRow);
  const rejectedDocs = caseRow.portal.documents.filter((d) => d.verifyStatus === "rejected");
  const isReupload = rejectedDocs.length > 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopied("link");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyCreds() {
    const ok = await copyInvitationCredentials(caseRow);
    if (ok) {
      setCopied("creds");
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title={isReupload ? "Notify candidate — re-upload" : "Onboarding Invitation"}
      description={
        isReupload
          ? `Portal reopened for ${caseRow.candidateName}. Email the login credentials so they can sign in and re-upload.`
          : `Login credentials for ${caseRow.candidateName}`
      }
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
            Join {caseRow.joiningDate || "—"}
          </p>
          {isReupload ? (
            <p className="mt-2 text-amber-800">
              Rejected: {rejectedDocs.map((d) => d.fileName).filter(Boolean).join(", ") || "document(s)"}
              . Candidate must sign in and re-upload under Documents.
            </p>
          ) : null}
          {caseRow.invitation?.sentAt ? (
            <p className="mt-2 text-amber-800">
              Last sent {new Date(caseRow.invitation.sentAt).toLocaleString()} via{" "}
              {caseRow.invitation.lastChannel ?? caseRow.invitation.channel} · Resends:{" "}
              {caseRow.invitation.resendCount}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
          <p className="font-semibold">HR testing — candidate login</p>
          <p className="mt-1 text-amber-900/90">
            Same email and auto-generated password are emailed to the candidate. Use these if the
            token/link is missing — they sign in again at the login page.
          </p>
        </div>

        <SetupField
          label="Login page"
          hint="LAN address so a phone or other device on the same network can open it"
        >
          <div className="flex gap-2">
            <SetupInput value={loginUrl} readOnly className="font-mono text-[11px]" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => void copyLink()}
            >
              <Copy className="size-3.5" />
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
        </SetupField>

        <SetupField label="Email">
          <SetupInput value={loginEmail || "No email"} readOnly />
        </SetupField>

        <SetupField label="Password (auto-generated)">
          <div className="flex gap-2">
            <SetupInput
              value={portalPassword || "Generate by sending invitation"}
              readOnly
              className="font-mono text-[13px] tracking-wide"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => void copyCreds()}
              disabled={!portalPassword}
            >
              <Copy className="size-3.5" />
              {copied === "creds" ? "Copied" : "Copy all"}
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
