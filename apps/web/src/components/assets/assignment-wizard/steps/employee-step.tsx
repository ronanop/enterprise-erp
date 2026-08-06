"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WizardSelectOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_EMPLOYEES } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";

const ALLOCATION_TYPES = ["employee", "department", "project", "branch", "warehouse"] as const;

export type EmployeeStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  showAdvancedAllocation?: boolean;
  employees?: WizardSelectOption[];
};

export function EmployeeStep({
  state,
  onChange,
  showAdvancedAllocation,
  employees = MOCK_EMPLOYEES,
}: EmployeeStepProps) {
  return (
    <div className="grid max-w-lg gap-4">
      <div className="space-y-2">
        <Label htmlFor="wiz-allocation-type">Allocation type</Label>
        <Select
          value={state.allocationType}
          onValueChange={(value) => onChange({ allocationType: value })}
        >
          <SelectTrigger id="wiz-allocation-type" className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(showAdvancedAllocation ? ALLOCATION_TYPES : (["employee"] as const)).map((type) => (
              <SelectItem key={type} value={type} className="cursor-pointer capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.allocationType === "employee" ? (
        <div className="space-y-2">
          <Label htmlFor="wiz-employee">Employee *</Label>
          <Select
            value={state.employeeId || "__none"}
            onValueChange={(v) => onChange({ employeeId: v === "__none" ? "" : v })}
          >
            <SelectTrigger id="wiz-employee" className="cursor-pointer">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select employee…
              </SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                  {emp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="wiz-expected-return">Expected return</Label>
        <Input
          id="wiz-expected-return"
          type="date"
          value={state.expectedReturnAt}
          onChange={(e) => onChange({ expectedReturnAt: e.target.value })}
        />
      </div>
    </div>
  );
}
