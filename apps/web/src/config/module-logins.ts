/**
 * Post-login redirects for standalone HRMS.
 */

export const DEMO_PASSWORD = "Secure1!";

export type ModuleLoginAccount = {
  email: string;
  displayName: string;
  moduleKey: string;
  moduleTitle: string;
  href: string;
};

export type AdminLoginAccount = {
  email: string;
  displayName: string;
  href: string;
  kind: "platform" | "tenant";
};

/** Platform / tenant admins land on the HRMS dashboard. */
export const adminLoginAccounts: AdminLoginAccount[] = [
  {
    email: "admin@example.com",
    displayName: "Platform Admin",
    href: "/hr",
    kind: "platform",
  },
  {
    email: "techbank@cachedigitech.com",
    displayName: "TechBank (Platform Admin)",
    href: "/hr",
    kind: "platform",
  },
  {
    email: "tenant.admin@example.com",
    displayName: "Tenant Admin",
    href: "/hr",
    kind: "tenant",
  },
];

export const moduleLoginAccounts: ModuleLoginAccount[] = [
  {
    email: "hr.user@example.com",
    displayName: "HRMS User",
    moduleKey: "hr",
    moduleTitle: "HRMS",
    href: "/hr",
  },
];

const redirectByEmail = new Map<string, string>([
  ...adminLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
  ...moduleLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
]);

/** Resolve post-login destination. Default → `/hr`. */
export function getPostLoginRedirect(email: string | null | undefined): string {
  if (!email) return "/hr";
  return redirectByEmail.get(email.trim().toLowerCase()) ?? "/hr";
}

export function getModuleLoginByEmail(email: string): ModuleLoginAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return moduleLoginAccounts.find((a) => a.email.toLowerCase() === normalized);
}
