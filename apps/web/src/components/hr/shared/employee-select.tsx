"use client";

import {
  SetupField,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { HrMasterOption } from "@/services/hr-master-connector";

export function EmployeeSelect({
  label = "Employee",
  value,
  onChange,
  options,
  required,
  placeholder = "Select employee…",
  allowEmpty = true,
  searchPlaceholder = "Search name or Emp Code…",
}: {
  label?: string;
  value: string;
  onChange: (id: string, option?: HrMasterOption) => void;
  options: HrMasterOption[];
  required?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  searchPlaceholder?: string;
}) {
  const selectOptions = options.map((o) => ({
    value: o.id,
    label: `${o.label}${o.department ? ` · ${o.department}` : ""}`,
    description: o.code || undefined,
  }));

  return (
    <SetupField label={label} required={required}>
      <SearchableSelect
        value={value}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        allowCustomValue={Boolean(allowEmpty)}
        options={selectOptions}
        onChange={(id) => {
          onChange(
            id,
            options.find((o) => o.id === id),
          );
        }}
        className="w-full"
      />
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
