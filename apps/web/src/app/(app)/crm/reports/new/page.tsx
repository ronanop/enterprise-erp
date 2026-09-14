import { ReportBuilderPage } from "@/components/crm/sales/report-builder-page";

interface PageProps {
  searchParams: Promise<{ module?: string | string[]; name?: string | string[] }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function CrmReportNewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return (
    <ReportBuilderPage
      mode="create"
      initialModule={firstParam(sp.module)}
      initialName={firstParam(sp.name)}
    />
  );
}
