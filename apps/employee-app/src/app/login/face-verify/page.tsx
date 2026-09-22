import { Suspense } from "react";
import FaceVerifyPage from "./face-verify-page";

export default function FaceVerifyRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <FaceVerifyPage />
    </Suspense>
  );
}
