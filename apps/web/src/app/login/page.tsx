import { Suspense } from "react";

import { LoginGateClient } from "./login-gate-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Checking access…
        </div>
      }
    >
      <LoginGateClient />
    </Suspense>
  );
}
