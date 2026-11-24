import { Suspense } from "react";

import AdminLoginPage from "./admin-login-page";

/** Always fresh HTML so browsers pick up new auth client chunks after deploy. */
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading admin sign-in…
        </div>
      }
    >
      <AdminLoginPage />
    </Suspense>
  );
}
