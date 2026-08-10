import { TimesheetFormPage } from "@/components/projects/timesheet-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditTimesheetRoute({ params }: PageProps) {
  const { row_id: timesheetId } = await params;
  return <TimesheetFormPage timesheetId={timesheetId} />;
}
