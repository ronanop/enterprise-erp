import LoginPageClient from "./login-page-client";

/** Server page — avoids ClientPageRoot injecting Promise params/searchParams. */
export default function LoginPage() {
  return <LoginPageClient />;
}
