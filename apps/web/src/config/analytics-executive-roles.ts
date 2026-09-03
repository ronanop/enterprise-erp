export type ExecutiveRole = "ceo" | "cfo" | "coo" | "chro";

export type ExecutiveRoleConfig = {
  label: string;
  kpis: string[];
};

/** Keys matching Phase 1 `source_kpi_key` where seeded; others are placeholders. */
export const ANALYTICS_EXECUTIVE_ROLES: Record<ExecutiveRole, ExecutiveRoleConfig> = {
  ceo: {
    label: "CEO",
    kpis: [
      "master.active_customers",
      "placeholder.revenue",
      "placeholder.profit",
      "placeholder.cash",
    ],
  },
  cfo: {
    label: "CFO",
    kpis: [
      "placeholder.ar_aging",
      "placeholder.ap_aging",
      "placeholder.cash_position",
      "placeholder.budget_variance",
    ],
  },
  coo: {
    label: "COO",
    kpis: [
      "master.active_vendors",
      "placeholder.production_output",
      "placeholder.inventory",
      "placeholder.order_fulfillment",
    ],
  },
  chro: {
    label: "CHRO",
    kpis: [
      "org.headcount_by_department",
      "placeholder.attrition",
      "placeholder.attendance",
      "placeholder.payroll_cost",
    ],
  },
};

export const EXECUTIVE_ROLE_ORDER: ExecutiveRole[] = ["ceo", "cfo", "coo", "chro"];
