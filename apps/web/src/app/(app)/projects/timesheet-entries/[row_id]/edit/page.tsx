import { TimesheetEntryFormPage } from "@/components/projects/timesheet-entry-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditTimesheetEntryRoute({ params }: PageProps) {
  const { row_id: entryId } = await params;
  return <TimesheetEntryFormPage entryId={entryId} />;
}
