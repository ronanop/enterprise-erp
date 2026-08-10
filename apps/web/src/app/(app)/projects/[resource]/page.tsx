import { notFound } from "next/navigation";

import { ChangeRequestListPage } from "@/components/projects/change-request-list-page";
import { ProjectBudgetListPage } from "@/components/projects/project-budget-list-page";
import { ProjectCostListPage } from "@/components/projects/project-cost-list-page";
import { ProjectDocumentListPage } from "@/components/projects/project-document-list-page";
import { ProjectIssueListPage } from "@/components/projects/project-issue-list-page";
import { ProjectListPage } from "@/components/projects/project-list-page";
import { ProjectMilestoneListPage } from "@/components/projects/project-milestone-list-page";
import { ProjectPhaseListPage } from "@/components/projects/project-phase-list-page";
import { ProjectProfitabilityPage } from "@/components/projects/project-profitability-page";
import { ProjectRiskListPage } from "@/components/projects/project-risk-list-page";
import { ProjectTaskListPage } from "@/components/projects/project-task-list-page";
import { ResourceAllocationListPage } from "@/components/projects/resource-allocation-list-page";
import { ResourcePlanListPage } from "@/components/projects/resource-plan-list-page";
import { SiteInstallationListPage } from "@/components/projects/site-installation-list-page";
import { TaskBoardPage } from "@/components/projects/task-board-page";
import { TimesheetEntryListPage } from "@/components/projects/timesheet-entry-list-page";
import { TimesheetListPage } from "@/components/projects/timesheet-list-page";
import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

const SITE_STAGE_RESOURCES: Record<string, string> = {
  "site-installations": "",
  intake: "intake",
  assignment: "assignment",
  survey: "survey",
  scm: "scm",
  installation: "installation",
  acceptance: "acceptance",
  completed: "completed",
};

export default async function ProjectsResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;

  if (resourceKey in SITE_STAGE_RESOURCES) {
    const stage = SITE_STAGE_RESOURCES[resourceKey];
    return <SiteInstallationListPage stage={stage || undefined} />;
  }

  switch (resourceKey) {
    case "projects":
      return <ProjectListPage />;
    case "project-phases":
      return <ProjectPhaseListPage />;
    case "project-milestones":
      return <ProjectMilestoneListPage />;
    case "project-tasks":
      return <ProjectTaskListPage />;
    case "task-board":
      return <TaskBoardPage />;
    case "timesheets":
      return <TimesheetListPage />;
    case "timesheet-entries":
      return <TimesheetEntryListPage />;
    case "resource-plans":
      return <ResourcePlanListPage />;
    case "resource-allocations":
      return <ResourceAllocationListPage />;
    case "project-budgets":
      return <ProjectBudgetListPage />;
    case "project-costs":
      return <ProjectCostListPage />;
    case "profitability":
      return <ProjectProfitabilityPage />;
    case "project-issues":
      return <ProjectIssueListPage />;
    case "project-risks":
      return <ProjectRiskListPage />;
    case "change-requests":
      return <ChangeRequestListPage />;
    case "project-documents":
      return <ProjectDocumentListPage />;
    default:
      break;
  }

  const mod = getModule("projects");
  const resource = getResource("projects", resourceKey);
  if (!mod || !resource) notFound();

  return (
    <ResourceListView
      moduleKey={mod.key}
      moduleTitle={mod.title}
      title={resource.title}
      description={resource.description}
      apiPath={resource.apiPath}
    />
  );
}
