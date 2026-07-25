"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { SetupEntityPanel, type FieldDef } from "@/components/hr/setup/setup-entity-panel";
import { SetupToastHost } from "@/components/hr/setup/setup-toast";
import { toApiTimeValue, toTimeInputValue } from "@/components/hr/setup/setup-drawer";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  getSetupSection,
  getSetupTab,
  hrSetupSections,
  type HrSetupTab,
  type HrSetupTabId,
} from "@/config/hr-setup";
import { cell, type SetupRow } from "@/services/hr-setup-service";
import { cn } from "@/lib/utils";

function mapBranch(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.branch_code,
    name: row.branch_name,
    location: [row.city, row.state_code, row.country_code].filter(Boolean).join(", ") || "—",
  };
}

function mapDepartment(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.department_code,
    name: row.department_name,
    head: row.head_employee_id ?? "—",
  };
}

function mapDesignation(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.designation_code,
    name: row.designation_name,
    level: row.job_level ?? "—",
  };
}

function mapLeaveType(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.leave_type_code,
    name: row.leave_type_name,
    paid: row.is_paid ? "Yes" : "No",
  };
}

function mapHoliday(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.calendar_code,
    name: row.calendar_name,
    year: row.calendar_year,
  };
}

function mapShift(row: SetupRow): SetupRow {
  const start = toTimeInputValue(String(row.start_time ?? ""));
  const end = toTimeInputValue(String(row.end_time ?? ""));
  return {
    ...row,
    code: row.shift_code,
    name: row.shift_name,
    start_time: start,
    end_time: end,
    timing: start && end ? `${start} – ${end}` : "—",
  };
}

function mapAssignment(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.document_number,
    name: String(row.employee_id ?? "").slice(0, 8),
    shift: String(row.shift_id ?? "").slice(0, 8),
  };
}

function mapComponent(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.component_code,
    name: row.component_name,
    class: row.component_class,
  };
}

function mapTax(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.tax_config_code,
    name: row.tax_config_name,
  };
}

function mapStatutory(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.contribution_code,
    name: row.contribution_name,
  };
}

function mapWorkflow(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.workflow_code,
    name: row.workflow_name,
  };
}

function mapTemplate(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.template_code,
    name: row.template_name,
    channel: row.channel,
  };
}

function mapRole(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.role_code,
    name: row.role_name,
  };
}

function mapLocation(row: SetupRow): SetupRow {
  return {
    ...row,
    code: row.location_code,
    name: row.location_name,
  };
}

type TabConfig = {
  columns: { key: string; label: string; render?: (row: SetupRow) => React.ReactNode }[];
  fields: FieldDef[];
  nameKeys: string[];
  codeKey?: string;
  mapApiRow?: (row: SetupRow) => SetupRow;
  buildCreateBody?: (form: Record<string, string>) => Record<string, unknown>;
  buildUpdateBody?: (form: Record<string, string>) => Record<string, unknown>;
  /** Status values used by Activate / Deactivate / Archive toolbar actions */
  statusActions?: {
    activate?: string;
    deactivate?: string;
    archive?: string;
  };
};

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

const HOLIDAY_STATUS_FIELD: FieldDef = {
  key: "status",
  label: "Status",
  type: "select",
  options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ],
};

const TAB_CONFIG: Partial<Record<HrSetupTabId, TabConfig>> = {
  branches: {
    nameKeys: ["name", "branch_name"],
    codeKey: "branch_code",
    mapApiRow: mapBranch,
    columns: [
      { key: "name", label: "Branch Name" },
      { key: "code", label: "Code" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "branch_name", label: "Branch Name", required: true },
      { key: "branch_code", label: "Branch Code", required: true, readOnly: true, hint: "Auto-generated" },
      {
        key: "company_id",
        label: "Company",
        required: true,
        type: "select",
        optionsSource: "companies",
        autoDefault: true,
        hint: "Auto-selected from organization",
      },
      { key: "branch_type", label: "Branch Type", type: "select", options: [
        { value: "head_office", label: "Head Office" },
        { value: "regional", label: "Regional" },
        { value: "satellite", label: "Satellite" },
      ]},
      { key: "address_line1", label: "Address" },
      { key: "city", label: "City" },
      { key: "state_code", label: "State" },
      { key: "country_code", label: "Country", placeholder: "IN" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      company_id: f.company_id,
      branch_code: f.branch_code,
      branch_name: f.branch_name,
      branch_type: f.branch_type || "regional",
      address_line1: f.address_line1 || null,
      city: f.city || null,
      state_code: f.state_code || null,
      country_code: f.country_code || "IN",
    }),
    buildUpdateBody: (f) => ({
      branch_name: f.branch_name,
      branch_type: f.branch_type || undefined,
      status: f.status,
      address_line1: f.address_line1 || undefined,
      city: f.city || undefined,
    }),
  },
  departments: {
    nameKeys: ["name", "department_name"],
    codeKey: "department_code",
    mapApiRow: mapDepartment,
    columns: [
      { key: "name", label: "Department" },
      { key: "code", label: "Code" },
      { key: "head", label: "Head" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "department_name", label: "Department Name", required: true },
      {
        key: "department_code",
        label: "Department Code",
        required: true,
        readOnly: true,
        hint: "Auto-generated (DEP-001, DEP-002…)",
      },
      {
        key: "company_id",
        label: "Company",
        required: true,
        type: "select",
        optionsSource: "companies",
        autoDefault: true,
        hint: "Auto-selected from organization",
      },
      {
        key: "branch_id",
        label: "Branch",
        required: true,
        type: "select",
        optionsSource: "branches",
        autoDefault: true,
        hint: "Auto-selected from organization",
      },
      {
        key: "parent_department_id",
        label: "Parent Department",
        type: "select",
        optionsSource: "departments",
        hint: "Optional hierarchy parent",
      },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      company_id: f.company_id,
      branch_id: f.branch_id,
      department_code: f.department_code,
      department_name: f.department_name,
      parent_department_id: f.parent_department_id || null,
    }),
    buildUpdateBody: (f) => ({
      department_name: f.department_name,
      status: f.status,
      parent_department_id: f.parent_department_id || null,
    }),
  },
  designations: {
    nameKeys: ["name", "designation_name"],
    codeKey: "designation_code",
    mapApiRow: mapDesignation,
    columns: [
      { key: "name", label: "Designation" },
      { key: "code", label: "Code" },
      { key: "level", label: "Level" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "designation_name", label: "Designation Name", required: true },
      {
        key: "designation_code",
        label: "Designation Code",
        required: true,
        readOnly: true,
        hint: "Auto-generated",
      },
      {
        key: "branch_id",
        label: "Branch",
        type: "select",
        optionsSource: "branches",
        autoDefault: true,
      },
      {
        key: "job_level",
        label: "Level",
        type: "select",
        options: [
          { value: "junior", label: "Junior" },
          { value: "mid", label: "Mid" },
          { value: "senior", label: "Senior" },
          { value: "lead", label: "Lead" },
          { value: "exec", label: "Exec" },
        ],
      },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      designation_code: f.designation_code,
      designation_name: f.designation_name,
      branch_id: f.branch_id || null,
      job_level: f.job_level || null,
      status: f.status || "active",
    }),
    buildUpdateBody: (f) => ({
      designation_name: f.designation_name,
      job_level: f.job_level || null,
      status: f.status,
    }),
  },
  "job-levels": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Level" },
      { key: "code", label: "Code" },
      { key: "sort_order", label: "Order" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Level Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      { key: "sort_order", label: "Sort Order", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
      STATUS_FIELD,
    ],
  },
  grades: {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Grade" },
      { key: "code", label: "Code" },
      { key: "min_salary", label: "Min Salary" },
      { key: "max_salary", label: "Max Salary" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Grade Name", required: true, placeholder: "L1" },
      { key: "code", label: "Code", required: true, readOnly: true },
      { key: "min_salary", label: "Minimum Salary", type: "number" },
      { key: "max_salary", label: "Maximum Salary", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
      STATUS_FIELD,
    ],
  },
  "work-locations": {
    nameKeys: ["name", "location_name"],
    codeKey: "location_code",
    mapApiRow: mapLocation,
    columns: [
      { key: "name", label: "Location" },
      { key: "code", label: "Code" },
      { key: "location_type", label: "Type" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "location_name", label: "Location Name", required: true },
      { key: "location_code", label: "Code", required: true, readOnly: true },
      {
        key: "company_id",
        label: "Company",
        required: true,
        type: "select",
        optionsSource: "companies",
        autoDefault: true,
      },
      {
        key: "branch_id",
        label: "Branch",
        required: true,
        type: "select",
        optionsSource: "branches",
        autoDefault: true,
      },
      {
        key: "location_type",
        label: "Type",
        type: "select",
        options: [
          { value: "office", label: "Office" },
          { value: "warehouse", label: "Warehouse" },
          { value: "plant", label: "Plant" },
          { value: "remote", label: "Remote" },
        ],
      },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      company_id: f.company_id,
      branch_id: f.branch_id,
      location_code: f.location_code,
      location_name: f.location_name,
      location_type: f.location_type || "office",
    }),
  },
  "employment-types": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Type" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      { key: "description", label: "Description", type: "textarea" },
      STATUS_FIELD,
    ],
  },
  reporting: {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Manager" },
      { key: "employee_code", label: "Code" },
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Name", readOnly: true },
      { key: "employee_code", label: "Employee Code", readOnly: true },
      { key: "role", label: "Role", readOnly: true },
      STATUS_FIELD,
    ],
  },
  "document-types": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Document" },
      { key: "code", label: "Code" },
      {
        key: "mandatory",
        label: "Mandatory",
        render: (r) => (r.mandatory ? "Yes" : "No"),
      },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      { key: "mandatory", label: "Mandatory", type: "checkbox" },
      { key: "expiry_required", label: "Expiry Required", type: "checkbox" },
      { key: "formats", label: "Allowed Formats", placeholder: "PDF,JPG" },
      { key: "max_size_mb", label: "Max Size (MB)", type: "number" },
      STATUS_FIELD,
    ],
  },
  "leave-policies": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Policy" },
      { key: "code", label: "Code" },
      { key: "leave_type", label: "Leave Type" },
      { key: "leave_days", label: "Days" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Policy Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      {
        key: "leave_type",
        label: "Leave Type",
        type: "select",
        options: [
          "Annual Leave",
          "Casual Leave",
          "Sick Leave",
          "Maternity",
          "Paternity",
          "Comp Off",
          "Marriage",
          "Bereavement",
        ].map((v) => ({ value: v, label: v })),
      },
      { key: "leave_days", label: "Leave Days", type: "number", required: true },
      { key: "carry_forward", label: "Carry Forward", type: "checkbox" },
      { key: "max_carry", label: "Maximum Carry", type: "number" },
      { key: "negative_balance", label: "Negative Balance Allowed", type: "checkbox" },
      { key: "half_day", label: "Half Day Allowed", type: "checkbox" },
      { key: "requires_approval", label: "Requires Approval", type: "checkbox" },
      { key: "approval_flow", label: "Approval Flow", placeholder: "Manager → HR → Director" },
      { key: "effective_from", label: "Effective From", type: "date" },
      { key: "effective_to", label: "Effective To", type: "date" },
      STATUS_FIELD,
    ],
  },
  "leave-types": {
    nameKeys: ["name", "leave_type_name"],
    codeKey: "leave_type_code",
    mapApiRow: mapLeaveType,
    columns: [
      { key: "name", label: "Leave Type" },
      { key: "code", label: "Code" },
      { key: "paid", label: "Paid" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "leave_type_name", label: "Name", required: true },
      { key: "leave_type_code", label: "Code", required: true, readOnly: true },
      { key: "is_paid", label: "Paid", type: "checkbox" },
      { key: "max_days_per_year", label: "Max Days / Year", type: "number" },
      { key: "requires_attachment", label: "Requires Attachment", type: "checkbox" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      leave_type_code: f.leave_type_code,
      leave_type_name: f.leave_type_name,
      is_paid: f.is_paid === "true",
      max_days_per_year: f.max_days_per_year ? Number(f.max_days_per_year) : null,
      requires_attachment: f.requires_attachment === "true",
      status: f.status || "active",
    }),
    buildUpdateBody: (f) => ({
      leave_type_name: f.leave_type_name,
      is_paid: f.is_paid === "true",
      max_days_per_year: f.max_days_per_year ? Number(f.max_days_per_year) : null,
      requires_attachment: f.requires_attachment === "true",
      status: f.status,
    }),
  },
  "holiday-calendar": {
    nameKeys: ["name", "calendar_name"],
    codeKey: "calendar_code",
    mapApiRow: mapHoliday,
    columns: [
      { key: "name", label: "Calendar" },
      { key: "code", label: "Code" },
      { key: "year", label: "Year" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "calendar_name", label: "Holiday / Calendar Name", required: true },
      { key: "calendar_code", label: "Code", required: true, readOnly: true },
      { key: "calendar_year", label: "Year", type: "number", required: true },
      { key: "branch_id", label: "Branch ID" },
      HOLIDAY_STATUS_FIELD,
    ],
    statusActions: {
      activate: "published",
      deactivate: "archived",
      archive: "archived",
    },
    buildCreateBody: (f) => ({
      calendar_code: f.calendar_code,
      calendar_name: f.calendar_name,
      calendar_year: Number(f.calendar_year),
      branch_id: f.branch_id || null,
      status: f.status || "draft",
    }),
    buildUpdateBody: (f) => ({
      calendar_name: f.calendar_name,
      status: f.status,
    }),
  },
  "shift-master": {
    nameKeys: ["name", "shift_name"],
    codeKey: "shift_code",
    mapApiRow: mapShift,
    columns: [
      { key: "name", label: "Shift" },
      { key: "code", label: "Code" },
      { key: "timing", label: "Timing" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "shift_name", label: "Shift Name", required: true },
      { key: "shift_code", label: "Shift Code", required: true, readOnly: true },
      {
        key: "shift_type",
        label: "Shift Type",
        type: "select",
        options: [
          { value: "general", label: "General" },
          { value: "morning", label: "Morning" },
          { value: "evening", label: "Evening" },
          { value: "night", label: "Night" },
        ],
      },
      {
        key: "start_time",
        label: "Start Time",
        type: "time",
        required: true,
        hint: "24-hour format (HH:MM)",
      },
      {
        key: "end_time",
        label: "End Time",
        type: "time",
        required: true,
        hint: "24-hour format (HH:MM)",
      },
      {
        key: "break_start",
        label: "Break Start",
        type: "time",
        hint: "Optional break window start",
      },
      {
        key: "break_end",
        label: "Break End",
        type: "time",
        hint: "Optional break window end",
      },
      { key: "grace_minutes", label: "Grace Time (min)", type: "number" },
      { key: "break_minutes", label: "Break Duration (min)", type: "number" },
      { key: "is_overnight", label: "Night Shift", type: "checkbox" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      shift_code: f.shift_code,
      shift_name: f.shift_name,
      shift_type: f.shift_type || "general",
      start_time: toApiTimeValue(f.start_time),
      end_time: toApiTimeValue(f.end_time),
      grace_minutes: Number(f.grace_minutes || 0),
      break_minutes: f.break_minutes ? Number(f.break_minutes) : null,
      is_overnight: f.is_overnight === "true",
      status: f.status || "active",
    }),
    buildUpdateBody: (f) => ({
      shift_name: f.shift_name,
      start_time: toApiTimeValue(f.start_time) || undefined,
      end_time: toApiTimeValue(f.end_time) || undefined,
      status: f.status,
    }),
  },
  "shift-rotation": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Rotation" },
      { key: "code", label: "Code" },
      { key: "cycle", label: "Cycle" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Rotation Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      {
        key: "cycle",
        label: "Cycle",
        type: "select",
        options: [
          { value: "weekly", label: "Weekly" },
          { value: "bi_weekly", label: "Bi Weekly" },
          { value: "monthly", label: "Monthly" },
        ],
      },
      { key: "shift_sequence", label: "Shift Sequence", placeholder: "SFT-001 → SFT-002 → SFT-003" },
      { key: "description", label: "Description", type: "textarea" },
      STATUS_FIELD,
    ],
  },
  "shift-assignment": {
    nameKeys: ["name", "document_number"],
    codeKey: "document_number",
    mapApiRow: mapAssignment,
    columns: [
      { key: "code", label: "Document" },
      { key: "name", label: "Employee" },
      { key: "shift", label: "Shift" },
      { key: "effective_from", label: "Effective" },
      { key: "status", label: "Status" },
    ],
    fields: [
      {
        key: "branch_id",
        label: "Branch",
        required: true,
        type: "select",
        optionsSource: "branches",
        autoDefault: true,
      },
      {
        key: "employee_id",
        label: "Employee",
        required: true,
        type: "select",
        optionsSource: "employees",
      },
      {
        key: "shift_id",
        label: "Shift",
        required: true,
        type: "select",
        optionsSource: "shifts",
      },
      { key: "effective_from", label: "Effective Date", type: "date", required: true },
      { key: "effective_to", label: "End Date", type: "date" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      branch_id: f.branch_id,
      employee_id: f.employee_id,
      shift_id: f.shift_id,
      effective_from: f.effective_from,
      effective_to: f.effective_to || null,
    }),
    buildUpdateBody: (f) => ({
      branch_id: f.branch_id || undefined,
      employee_id: f.employee_id || undefined,
      shift_id: f.shift_id || undefined,
      effective_from: f.effective_from || undefined,
      effective_to: f.effective_to || null,
      status: f.status || undefined,
    }),
  },
  "attendance-rules": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Rule" },
      { key: "code", label: "Code" },
      { key: "grace_minutes", label: "Grace" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Rule Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      { key: "grace_minutes", label: "Grace Minutes", type: "number" },
      { key: "late_mark_after", label: "Late Mark After (min)", type: "number" },
      { key: "half_day_hours", label: "Half Day Hours", type: "number" },
      { key: "full_day_hours", label: "Full Day Hours", type: "number" },
      { key: "overtime_allowed", label: "Overtime Allowed", type: "checkbox" },
      STATUS_FIELD,
    ],
  },
  "salary-components": {
    nameKeys: ["name", "component_name"],
    codeKey: "component_code",
    mapApiRow: mapComponent,
    columns: [
      { key: "name", label: "Component" },
      { key: "code", label: "Code" },
      { key: "class", label: "Class" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "component_name", label: "Name", required: true },
      { key: "component_code", label: "Code", required: true },
      {
        key: "component_class",
        label: "Class",
        type: "select",
        options: [
          { value: "earning", label: "Earning" },
          { value: "deduction", label: "Deduction" },
          { value: "employer_contribution", label: "Employer Contribution" },
        ],
      },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      component_code: f.component_code,
      component_name: f.component_name,
      component_class: f.component_class || "earning",
      status: f.status || "active",
    }),
  },
  "bank-master": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Bank" },
      { key: "code", label: "Code" },
      { key: "ifsc_prefix", label: "IFSC Prefix" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Bank Name", required: true },
      { key: "code", label: "Bank Code", required: true, readOnly: true },
      { key: "bank_code", label: "Short Code", required: true },
      { key: "ifsc_prefix", label: "IFSC Prefix" },
      STATUS_FIELD,
    ],
  },
  "tax-rules": {
    nameKeys: ["name", "tax_config_name"],
    codeKey: "tax_config_code",
    mapApiRow: mapTax,
    columns: [
      { key: "name", label: "Tax Rule" },
      { key: "code", label: "Code" },
      { key: "tax_type", label: "Type" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "tax_config_name", label: "Name", required: true },
      { key: "tax_config_code", label: "Code", required: true },
      {
        key: "tax_type",
        label: "Tax Type",
        type: "select",
        options: [
          { value: "income_tax", label: "Income Tax" },
          { value: "professional_tax", label: "Professional Tax" },
          { value: "other", label: "Other" },
        ],
      },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      tax_config_code: f.tax_config_code,
      tax_config_name: f.tax_config_name,
      tax_type: f.tax_type || "income_tax",
      status: f.status || "draft",
    }),
  },
  "pf-esi": {
    nameKeys: ["name", "contribution_name"],
    codeKey: "contribution_code",
    mapApiRow: mapStatutory,
    columns: [
      { key: "name", label: "Contribution" },
      { key: "code", label: "Code" },
      { key: "employee_rate_percent", label: "Employee %" },
      { key: "employer_rate_percent", label: "Employer %" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "contribution_name", label: "Name", required: true },
      { key: "contribution_code", label: "Code", required: true },
      { key: "employee_rate_percent", label: "Employee Rate %", type: "number" },
      { key: "employer_rate_percent", label: "Employer Rate %", type: "number" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      contribution_code: f.contribution_code,
      contribution_name: f.contribution_name,
      employee_rate_percent: Number(f.employee_rate_percent || 0),
      employer_rate_percent: Number(f.employer_rate_percent || 0),
      status: f.status || "active",
    }),
  },
  "approval-flows": {
    nameKeys: ["name", "workflow_name"],
    codeKey: "workflow_code",
    mapApiRow: mapWorkflow,
    columns: [
      { key: "name", label: "Workflow" },
      { key: "code", label: "Code" },
      { key: "module", label: "Module" },
      { key: "status", label: "Status", render: (r) => <HrStatusBadge status={cell(r, "status")} /> },
    ],
    fields: [
      { key: "workflow_name", label: "Name", required: true },
      { key: "workflow_code", label: "Code", required: true },
      { key: "module", label: "Module", placeholder: "hr" },
      { key: "document_type", label: "Document Type", placeholder: "leave_request" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      workflow_code: f.workflow_code,
      workflow_name: f.workflow_name,
      module: f.module || "hr",
      document_type: f.document_type || "generic",
      status: f.status || "active",
    }),
  },
  "email-templates": {
    nameKeys: ["name", "template_name"],
    codeKey: "template_code",
    mapApiRow: mapTemplate,
    columns: [
      { key: "name", label: "Template" },
      { key: "code", label: "Code" },
      { key: "channel", label: "Channel" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "template_name", label: "Name", required: true },
      { key: "template_code", label: "Code", required: true },
      {
        key: "channel",
        label: "Channel",
        type: "select",
        options: [
          { value: "email", label: "Email" },
          { value: "sms", label: "SMS" },
          { value: "push", label: "Push" },
        ],
      },
      { key: "subject_template", label: "Subject" },
      { key: "body_template", label: "Body", type: "textarea" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      template_code: f.template_code,
      template_name: f.template_name,
      channel: f.channel || "email",
      subject_template: f.subject_template || null,
      body_template: f.body_template || "",
      status: f.status || "active",
    }),
  },
  "notification-settings": {
    nameKeys: ["name"],
    columns: [
      { key: "name", label: "Channel" },
      { key: "code", label: "Code" },
      { key: "channel", label: "Type" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code", required: true, readOnly: true },
      {
        key: "channel",
        label: "Channel",
        type: "select",
        options: [
          { value: "email", label: "Email" },
          { value: "sms", label: "SMS" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "push", label: "Push" },
        ],
      },
      { key: "enabled", label: "Enabled", type: "checkbox" },
      STATUS_FIELD,
    ],
  },
  "roles-permissions": {
    nameKeys: ["name", "role_name"],
    codeKey: "role_code",
    mapApiRow: mapRole,
    columns: [
      { key: "name", label: "Role" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "role_name", label: "Role Name", required: true },
      { key: "role_code", label: "Role Code", required: true },
      { key: "description", label: "Description", type: "textarea" },
      STATUS_FIELD,
    ],
    buildCreateBody: (f) => ({
      role_code: f.role_code,
      role_name: f.role_name,
      description: f.description || null,
      status: f.status || "active",
    }),
  },
};

function TabPanel({ tab }: { tab: HrSetupTab }) {
  const cfg = TAB_CONFIG[tab.id];
  if (!cfg) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Configuration panel for {tab.title} is not registered yet.
      </div>
    );
  }
  return (
    <SetupEntityPanel
      tab={tab}
      columns={cfg.columns}
      fields={cfg.fields}
      nameKeys={cfg.nameKeys}
      codeKey={cfg.codeKey}
      mapApiRow={cfg.mapApiRow}
      buildCreateBody={cfg.buildCreateBody}
      buildUpdateBody={cfg.buildUpdateBody}
      statusActions={cfg.statusActions}
    />
  );
}

/** Enterprise HRMS configuration center */
export function HrSetupCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sectionId = searchParams.get("section") ?? "organization";
  const tabId = searchParams.get("tab");

  const section = useMemo(() => getSetupSection(sectionId), [sectionId]);
  const tab = useMemo(() => getSetupTab(section.id, tabId), [section, tabId]);

  function go(nextSection: string, nextTab?: string) {
    const params = new URLSearchParams();
    params.set("section", nextSection);
    if (nextTab) params.set("tab", nextTab);
    else {
      const s = getSetupSection(nextSection);
      params.set("tab", s.tabs[0]?.id ?? "");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <SetupToastHost />

      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/hr" className="cursor-pointer hover:text-foreground">
          HRMS
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Setup</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{section.title}</span>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{tab.title}</span>
      </nav>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">HR Setup</h1>
        <p className="text-xs text-muted-foreground">
          Enterprise configuration center for organization, leave, shifts, payroll, and workflows —
          foundation for Employee, Attendance, Leave, Payroll, Recruitment, Training, and Performance.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border/70 bg-card p-2 shadow-sm">
          <p className="px-2 py-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Configuration
          </p>
          <ul className="space-y-0.5">
            {hrSetupSections.map((s) => {
              const Icon = s.icon;
              const active = s.id === section.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate font-medium">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="erp-scroll overflow-x-auto rounded-xl border border-border/70 bg-card px-2 pt-2 shadow-sm">
            <div className="flex min-w-max gap-0.5 border-b border-border/70">
              {section.tabs.map((t) => {
                const active = t.id === tab.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => go(section.id, t.id)}
                    className={cn(
                      "cursor-pointer rounded-t-md px-3 py-2 text-xs font-medium transition-colors duration-200",
                      active
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>

          <TabPanel key={`${section.id}:${tab.id}`} tab={tab} />
        </div>
      </div>
    </div>
  );
}
