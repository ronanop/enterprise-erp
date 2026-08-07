import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";

function LoginFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted-foreground">
      Loading sign in…
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
