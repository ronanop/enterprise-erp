"use client";

import {
  SetupField,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import type { HrMasterOption } from "@/services/hr-master-connector";

export function EmployeeSelect({
  label = "Employee",
  value,
  onChange,
  options,
  required,
  placeholder = "Select employee…",
  allowEmpty = true,
}: {
  label?: string;
  value: string;
  onChange: (id: string, option?: HrMasterOption) => void;
  options: HrMasterOption[];
  required?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <SetupField label={label} required={required}>
      <SetupSelect
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          onChange(
            id,
            options.find((o) => o.id === id),
          );
        }}
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.department ? ` · ${o.department}` : ""}
          </option>
        ))}
      </SetupSelect>
    </SetupField>
  );
}

export function MasterSelect({
  label,
  value,
  onChange,
  options,
  required,
  placeholder = "Select…",
  allowEmpty = true,
  hint,
}: {
  label: string;
  value: string;
  onChange: (id: string, option?: HrMasterOption) => void;
  options: HrMasterOption[];
  required?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  hint?: string;
}) {
  return (
    <SetupField label={label} required={required} hint={hint}>
      <SetupSelect
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          onChange(
            id,
            options.find((o) => o.id === id || o.label === id),
          );
        }}
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.id || o.label} value={o.id || o.label}>
            {o.label}
          </option>
        ))}
      </SetupSelect>
    </SetupField>
  );
}
