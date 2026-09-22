"use client";

import { useMemo, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type {
  AtsCandidate,
  AtsOffer,
  JobOpening,
  OfferStatus,
  PipelineApplication,
} from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onSubmit: (
    input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt">,
  ) => void;
};

export function OfferDrawer({
  open,
  onClose,
  candidates,
  jobs,
  applications,
  onSubmit,
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [department, setDepartment] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [ctc, setCtc] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [offerLetterName, setOfferLetterName] = useState("");
  const [status, setStatus] = useState<OfferStatus>("sent");

  const applicationId = useMemo(() => {
    return (
      applications.find((a) => a.candidateId === candidateId && (!jobId || a.jobId === jobId))
        ?.id ?? ""
    );
  }, [applications, candidateId, jobId]);

  const selectedJob = jobs.find((j) => j.id === jobId);

  function save() {
    if (!candidateId || !joiningDate) return;
    onSubmit({
      candidateId,
      jobId: jobId || selectedJob?.id || "",
      applicationId,
      department: department || selectedJob?.department || "General",
      joiningDate,
      ctc: Number(ctc) || 0,
      expiryDate,
      offerLetterName,
      status,
    });
    onClose();
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Generate Offer"
      description="Offer ID is auto-generated (OFF-000001). Accepted offers feed Onboarding."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!candidateId || !joiningDate}
            onClick={save}
          >
            Generate Offer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Candidate" required>
          <SetupSelect value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.candidateCode} · {c.fullName}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Position">
          <SetupSelect
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              const j = jobs.find((x) => x.id === e.target.value);
              if (j) setDepartment(j.department);
            }}
          >
            <option value="">Select job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobCode} · {j.title}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Department">
          <SetupInput value={department} onChange={(e) => setDepartment(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Joining date" required>
            <SetupInput
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </SetupField>
          <SetupField label="Offer expiry">
            <SetupInput
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </SetupField>
        </div>
        <SetupField label="CTC">
          <SetupInput type="number" value={ctc} onChange={(e) => setCtc(e.target.value)} />
        </SetupField>
        <SetupField label="Offer letter file">
          <SetupInput
            value={offerLetterName}
            onChange={(e) => setOfferLetterName(e.target.value)}
            placeholder="offer-letter.pdf"
          />
        </SetupField>
        <SetupField label="Status">
          <SetupSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as OfferStatus)}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
