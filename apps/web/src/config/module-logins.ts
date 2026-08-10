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

export type MarketingTeamLoginAccount = {
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
    email: "tenant.admin@example.com",
    displayName: "Tenant Admin",
    href: "/",
    kind: "tenant",
  },
];

/** Service workflow demo team — head, engineers, and status-only contacts. */
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
  {
    email: "service.contact1@example.com",
    displayName: "Service Contact 1",
    role: "Status only (stakeholder)",
    href: "/service/service-request-tickets",
  },
  {
    email: "service.contact2@example.com",
    displayName: "Service Contact 2",
    role: "Status only (stakeholder)",
    href: "/service/service-request-tickets",
  },
];

/** Marketing workflow demo team — 6 roles with multi-verifier checklist. */
export const marketingTeamLoginAccounts: MarketingTeamLoginAccount[] = [
  {
    email: "marketing.head@example.com",
    displayName: "Marketing Head",
    role: "Final approval after all verifiers",
    href: "/marketing/workflow",
  },
  {
    email: "marketing.campaign@example.com",
    displayName: "Campaign & Social Media Handler",
    role: "First verifier · copy, theme, hashtags",
    href: "/marketing/workflow",
  },
  {
    email: "marketing.publisher@example.com",
    displayName: "Publisher",
    role: "Verify before head · publish after final approval",
    href: "/marketing/workflow",
  },
  {
    email: "marketing.creator@example.com",
    displayName: "Content Creator",
    role: "Draft · upload assets · submit",
    href: "/marketing/pipeline",
  },
  {
    email: "marketing.linkedin@example.com",
    displayName: "LinkedIn Handler",
    role: "Draft LinkedIn posts · send to marketing head",
    href: "/marketing/content",
  },
  {
    email: "marketing.video@example.com",
    displayName: "Video Editor",
    role: "Upload & verify video quality",
    href: "/marketing/workflow",
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
  ...serviceTeamLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
  ...marketingTeamLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
  ...moduleLoginAccounts.map((a) => [a.email.toLowerCase(), a.href] as const),
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
