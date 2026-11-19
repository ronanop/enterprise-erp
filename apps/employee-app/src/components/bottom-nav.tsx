"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCalendar,
  IconFingerprint,
  IconHome,
  IconUser,
  IconWallet,
} from "@/components/icons";

const tabs = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: "/attendance", label: "Attendance", Icon: IconFingerprint },
  { href: "/leave", label: "Leave", Icon: IconCalendar },
  { href: "/payslips", label: "Salary", Icon: IconWallet },
  { href: "/profile", label: "Profile", Icon: IconUser },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c3c6d7]/30 bg-[#f8f9ff]/85 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl transition-all duration-300"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Tab
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={active}
            />
          );
        })}
      </ul>
    </nav>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; filled?: boolean }>;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        className={`relative flex flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-90 ${
          active
            ? "text-[#004ac6]"
            : "text-[#434655]/60 hover:text-[#004ac6]"
        }`}
      >
        <Icon size={22} filled={active} />
        <span>{label}</span>
        {active ? (
          <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#004ac6]" />
        ) : null}
      </Link>
    </li>
  );
}
