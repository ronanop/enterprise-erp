"use client";

import { useCallback, useMemo, useState } from "react";

import {
  listCustomerOptions,
  listDepartmentOptions,
  listEmployeeOptions,
  listMilestoneOptions,
  listPhaseOptions,
  listProjectOptions,
  listResourcePlanOptions,
  listTaskOptions,
  listTimesheetOptions,
  type Option,
} from "@/services/projects-portal-service";

export type LookupKind =
  | "projects"
  | "employees"
  | "customers"
  | "departments"
  | "tasks"
  | "phases"
  | "milestones"
  | "plans"
  | "timesheets";

const LOADERS: Record<LookupKind, () => Promise<Option[]>> = {
  projects: listProjectOptions,
  employees: listEmployeeOptions,
  customers: listCustomerOptions,
  departments: listDepartmentOptions,
  tasks: listTaskOptions,
  phases: listPhaseOptions,
  milestones: listMilestoneOptions,
  plans: listResourcePlanOptions,
  timesheets: listTimesheetOptions,
};

type Maps = Partial<Record<LookupKind, Map<string, string>>>;

/**
 * Loads the reference lists a Projects screen needs and exposes id → label
 * helpers. A failing lookup degrades to an em dash rather than blanking the
 * whole screen.
 */
export function useProjectsLookups(kinds: readonly LookupKind[]) {
  const [maps, setMaps] = useState<Maps>({});
  const kindKey = kinds.join(",");

  const loadLookups = useCallback(async (): Promise<Partial<Record<LookupKind, Option[]>>> => {
    const wanted = kindKey ? (kindKey.split(",") as LookupKind[]) : [];
    const results = await Promise.all(
      wanted.map((kind) => LOADERS[kind]().catch(() => [] as Option[])),
    );
    const nextMaps: Maps = {};
    const options: Partial<Record<LookupKind, Option[]>> = {};
    wanted.forEach((kind, i) => {
      options[kind] = results[i];
      nextMaps[kind] = new Map(results[i].map((o) => [o.id, o.label]));
    });
    setMaps(nextMaps);
    return options;
  }, [kindKey]);

  const labels = useMemo(() => {
    const get = (kind: LookupKind, id: string | null | undefined) =>
      id ? (maps[kind]?.get(id) ?? "—") : "—";
    return {
      projectName: (id: string | null | undefined) => get("projects", id),
      employeeName: (id: string | null | undefined) => get("employees", id),
      customerName: (id: string | null | undefined) => get("customers", id),
      departmentName: (id: string | null | undefined) => get("departments", id),
      taskName: (id: string | null | undefined) => get("tasks", id),
      phaseName: (id: string | null | undefined) => get("phases", id),
      milestoneName: (id: string | null | undefined) => get("milestones", id),
      planName: (id: string | null | undefined) => get("plans", id),
      timesheetLabel: (id: string | null | undefined) => get("timesheets", id),
    };
  }, [maps]);

  return { loadLookups, labels };
}
