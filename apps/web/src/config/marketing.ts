import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Cloud,
  FileText,
  Gauge,
  ListTodo,
  Megaphone,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";

import { getModule } from "@/config/modules";

export const MARKETING_MODULE_KEY = "marketing";

export type MarketingQuickLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export const marketingQuickLinks: MarketingQuickLink[] = [
  {
    title: "Operations",
    description: "Campaign health and bottlenecks",
    href: "/marketing/operations",
    icon: Gauge,
  },
  {
    title: "Tasks",
    description: "Execute, delegate, or hybrid work",
    href: "/marketing/tasks",
    icon: ListTodo,
  },
  {
    title: "Microsoft 365",
    description: "Teams, SharePoint, OneDrive",
    href: "/marketing/m365",
    icon: Cloud,
  },
  {
    title: "Content Studio",
    description: "Create and score AI drafts",
    href: "/marketing/content",
    icon: Sparkles,
  },
  {
    title: "Campaigns",
    description: "Plan marketing campaigns",
    href: "/marketing/campaigns",
    icon: Megaphone,
  },
  {
    title: "Research",
    description: "Topic and trend intelligence",
    href: "/marketing/research",
    icon: Search,
  },
  {
    title: "Calendar",
    description: "Schedule publishes",
    href: "/marketing/calendar",
    icon: CalendarDays,
  },
  {
    title: "Brand Voice",
    description: "Train reusable voice",
    href: "/marketing/brand-voices",
    icon: FileText,
  },
  {
    title: "Social Accounts",
    description: "Connected channels",
    href: "/marketing/social-accounts",
    icon: Share2,
  },
  {
    title: "Competitors",
    description: "Watchlist and gaps",
    href: "/marketing/competitors",
    icon: Users,
  },
  {
    title: "Analytics",
    description: "Performance overview",
    href: "/marketing/analytics",
    icon: BarChart3,
  },
];

export function marketingResources() {
  return getModule(MARKETING_MODULE_KEY)?.resources ?? [];
}
