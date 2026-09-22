import { resourceService } from "@/services/api-client";

export type HrEssPolicyRow = {
  id: string;
  policy_code: string;
  title: string;
  policy_version: number;
  content_markdown: string;
  is_mandatory: boolean;
  display_order: number;
  published_at: string | null;
  status: string;
  company_id: string;
};

export const hrEssPoliciesService = {
  list: () => resourceService.list<HrEssPolicyRow>("/hr/ess-policies"),

  create: (body: {
    company_id?: string;
    policy_code: string;
    title: string;
    content_markdown: string;
    is_mandatory?: boolean;
    display_order?: number;
    status?: string;
  }) => resourceService.create("/hr/ess-policies", body),

  update: (
    id: string,
    body: Partial<{
      title: string;
      content_markdown: string;
      is_mandatory: boolean;
      display_order: number;
      status: string;
    }>,
  ) => resourceService.update("/hr/ess-policies", id, body),

  publish: (id: string) => resourceService.action("/hr/ess-policies", id, "publish"),

  archive: (id: string) => resourceService.action("/hr/ess-policies", id, "archive"),

  forcePasswordReset: (employeeId: string) =>
    resourceService.create(`/hr/employee-profiles/force-password-reset/${employeeId}`, {}),
};
