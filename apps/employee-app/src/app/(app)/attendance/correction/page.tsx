import { Suspense } from "react";
import AttendanceCorrectionPage from "./correction-page";

export default function AttendanceCorrectionRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <AttendanceCorrectionPage />
    </Suspense>
  );
}
