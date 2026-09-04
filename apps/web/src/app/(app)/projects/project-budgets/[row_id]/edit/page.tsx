import { ProjectBudgetFormPage } from "@/components/projects/project-budget-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectBudgetRoute({ params }: PageProps) {
  const { row_id: budgetId } = await params;
  return <ProjectBudgetFormPage budgetId={budgetId} />;
}
