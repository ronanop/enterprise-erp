import { SalaryStructureFormPage } from "@/components/hr/payroll/salary-structure-form-page";

export default async function EditSalaryStructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ structureId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { structureId } = await params;
  const { mode } = await searchParams;
  return <SalaryStructureFormPage structureId={structureId} readOnly={mode === "view"} />;
}
