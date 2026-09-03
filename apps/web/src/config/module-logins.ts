/**
 * Shared demo login catalog: module emails, password, and post-login redirects.
 * Email convention: `{moduleKey}.user@example.com` (module key from modules.ts).
 */

import { erpModules } from "@/config/modules";

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

export type ServiceTeamLoginAccount = {
  email: string;
  displayName: string;
  role: string;
  href: string;
};

/** Platform / tenant admins land on the overview dashboard. */
export const adminLoginAccounts: AdminLoginAccount[] = [
  {
    email: "admin@example.com",
    displayName: "Platform Admin",
    href: "/",
    kind: "platform",
  },
  {
    email: "techbank@cachedigitech.com",
    displayName: "TechBank (Platform Admin)",
    href: "/",
    kind: "platform",
  },
  {
    email: "tenant.admin@example.com",
    displayName: "Tenant Admin",
    href: "/",
    kind: "tenant",
  },
];

/**
 * Service workflow demo team — mirrors production roles after SSO assignment:
 * ERP admin → Service Head (module admin); Head → Service Engineers (module members).
 */
export const serviceTeamLoginAccounts: ServiceTeamLoginAccount[] = [
  {
    email: "service.head@example.com",
    displayName: "Service Head",
    role: "Assigns tickets · sees all",
    href: "/service/service-request-tickets",
  },
  {
    email: "service.engineer1@example.com",
    displayName: "Service Engineer 1",
    role: "Works assigned tickets",
    href: "/service/service-request-tickets",
  },
  {
    email: "service.engineer2@example.com",
    displayName: "Service Engineer 2",
    role: "Works assigned tickets",
    href: "/service/service-request-tickets",
  },
];

/** One demo user per ERP module — email uses the module registry key. */
export const moduleLoginAccounts: ModuleLoginAccount[] = erpModules.map((mod) => ({
  email: `${mod.key}.user@example.com`,
  displayName: `${mod.title} User`,
  moduleKey: mod.key,
  moduleTitle: mod.title,
  href: mod.href,
}));

const redirectByEmail = new Map<string, string>([
  ...adminLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
  ...moduleLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
  ...serviceTeamLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
]);

/** Resolve post-login destination from the signed-in email. Unknown → `/`. */
export function getPostLoginRedirect(email: string | null | undefined): string {
  if (!email) return "/";
  return redirectByEmail.get(email.trim().toLowerCase()) ?? "/";
}

export function getModuleLoginByEmail(email: string): ModuleLoginAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return moduleLoginAccounts.find((a) => a.email.toLowerCase() === normalized);
}
