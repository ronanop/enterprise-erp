"use client";

import { SetupEntityPanel, type FieldDef } from "@/components/hr/setup/setup-entity-panel";
import type { HrSetupTab } from "@/config/hr-setup";

const STATUS_FIELD: FieldDef = {
  key: "status",
  label: "Status",
  type: "select",
  options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "draft", label: "Draft" },
    { value: "archived", label: "Archived" },
  ],
};

const documentTypesTab: HrSetupTab = {
  id: "document-types",
  title: "Document Types",
  description: "KYC catalog — drives onboarding uploads",
  source: "local",
  codePrefix: "DOC",
};

const columns = [
  { key: "name", label: "Document" },
  { key: "code", label: "Code" },
  { key: "kind", label: "Kind" },
  {
    key: "mandatory",
    label: "Mandatory",
    render: (r: Record<string, unknown>) => (r.mandatory ? "Yes" : "No"),
  },
  {
    key: "max_files",
    label: "Max files",
    render: (r: Record<string, unknown>) =>
      r.max_files != null && r.max_files !== "" ? String(r.max_files) : r.multiple ? "Many" : "1",
  },
  { key: "status", label: "Status" },
];

const fields: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "code", label: "Code", required: true, readOnly: true },
  {
    key: "kind",
    label: "Onboarding kind",
    type: "select",
    options: [
      { value: "photo", label: "Photo" },
      { value: "resume", label: "Resume" },
      { value: "pan", label: "PAN" },
      { value: "aadhaar", label: "Aadhaar" },
      { value: "passport", label: "Passport" },
      { value: "education", label: "Graduation / Education" },
      { value: "experience", label: "Work Experience" },
      { value: "cancelled_cheque", label: "Cancelled Cheque" },
      { value: "bank_details", label: "Bank Details" },
      { value: "appointment_letter", label: "Appointment Letter" },
      { value: "relieving_letter", label: "Relieving Letter" },
      { value: "salary_slips", label: "Salary Slips" },
      { value: "previous_employer", label: "Previous Employer Certificate" },
      { value: "signature", label: "Signature" },
      { value: "other", label: "Other" },
    ],
    hint: "Maps this type to the candidate onboarding upload slot",
  },
  { key: "mandatory", label: "Mandatory", type: "checkbox" },
  { key: "expiry_required", label: "Expiry Required", type: "checkbox" },
  { key: "multiple", label: "Allow multiple files", type: "checkbox" },
  { key: "formats", label: "Allowed Formats", placeholder: "PDF,JPG" },
  { key: "max_size_mb", label: "Max Size (MB)", type: "number" },
  { key: "max_files", label: "Max files", type: "number", placeholder: "1" },
  STATUS_FIELD,
];

/** Document type catalog — edit / view / delete from EDoc. */
export function EdocDocumentTypesPanel() {
  return (
    <SetupEntityPanel
      tab={documentTypesTab}
      columns={columns}
      fields={fields}
      nameKeys={["name"]}
    />
  );
}
