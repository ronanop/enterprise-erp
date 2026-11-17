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

const ACTIVE = "#2563EB";
const INACTIVE = "#8B95A8";

const ATTENDANCE_HREF = "/attendance";
/** Center slot in the 5-column dock (0-based). */
const ATTENDANCE_INDEX = 2;
const NOTCH_X = 195;

const tabs = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: "/leave", label: "Leave", Icon: IconCalendar },
  { href: ATTENDANCE_HREF, label: "Attendance", Icon: IconFingerprint },
  { href: "/payslips", label: "Salary", Icon: IconWallet },
  { href: "/profile", label: "Profile", Icon: IconUser },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Smooth floating dock path with a fixed center well under Attendance. */
function curvedDockPath(notchX: number): string {
  const barLeft = 14;
  const barRight = 376;
  const topY = 0;
  const wellDepth = 40;
  const corner = 20;
  const wellHalf = 40;

  let wellLeft = notchX - wellHalf;
  let wellRight = notchX + wellHalf;
  const minFlat = barLeft + corner + 6;
  const maxFlat = barRight - corner - 6;
  wellLeft = Math.max(wellLeft, minFlat - 4);
  wellRight = Math.min(wellRight, maxFlat + 4);

  const cx = (wellLeft + wellRight) / 2;

  return `
    M ${barLeft} ${corner}
    C ${barLeft} ${corner * 0.4} ${barLeft + corner * 0.4} ${topY} ${barLeft + corner} ${topY}
    L ${Math.max(barLeft + corner, wellLeft - 8)} ${topY}
    C ${wellLeft} ${topY} ${wellLeft + 8} 9 ${wellLeft + 14} 17
    C ${wellLeft + 24} 31 ${cx - 12} ${wellDepth} ${cx} ${wellDepth}
    C ${cx + 12} ${wellDepth} ${wellRight - 24} 31 ${wellRight - 14} 17
    C ${wellRight - 8} 9 ${wellRight} ${topY} ${Math.min(barRight - corner, wellRight + 8)} ${topY}
    L ${barRight - corner} ${topY}
    C ${barRight - corner * 0.4} ${topY} ${barRight} ${corner * 0.4} ${barRight} ${corner}
    L ${barRight} 56
    C ${barRight} 68 ${barRight - 12} 76 ${barRight - 24} 76
    L ${barLeft + 24} 76
    C ${barLeft + 12} 76 ${barLeft} 68 ${barLeft} 56
    Z
  `;
}

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => isActive(pathname, tab.href)),
  );

  return (
    <nav
      data-bottom-nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
    >
      <div className="mx-auto w-full max-w-lg px-3 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-11">
        <div className="pointer-events-auto relative overflow-visible">
          <svg
            className="absolute inset-x-0 bottom-0 h-[4.75rem] w-full overflow-visible"
            viewBox="0 0 390 76"
            preserveAspectRatio="none"
            aria-hidden
            style={{
              filter: "drop-shadow(0 10px 28px rgba(15, 23, 42, 0.14))",
            }}
          >
            <path d={curvedDockPath(NOTCH_X)} fill="#FFFFFF" />
          </svg>

          <ul className="relative z-10 grid h-[4.75rem] grid-cols-5 items-end px-1 pb-2.5">
            {tabs.map((tab, index) => {
              const active = index === activeIndex;
              const isAttendance = index === ATTENDANCE_INDEX;

              return (
                <li
                  key={tab.href}
                  className="relative flex h-full items-end justify-center"
                >
                  {isAttendance ? (
                    <FloatingTab
                      href={tab.href}
                      label={tab.label}
                      Icon={tab.Icon}
                      active={active}
                    />
                  ) : (
                    <SideTab
                      href={tab.href}
                      label={tab.label}
                      Icon={tab.Icon}
                      active={active}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function FloatingTab({
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
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center active:scale-[0.97]"
    >
      <span className="absolute bottom-[1.65rem] flex h-[3.55rem] w-[3.55rem] items-center justify-center rounded-full bg-[linear-gradient(180deg,#5BA4FF_0%,#2563EB_55%,#1D4ED8_100%)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.42)]">
        <Icon size={26} filled />
      </span>
      <span
        className="pb-0.5 text-[11px] font-semibold leading-none tracking-wide"
        style={{ color: ACTIVE }}
      >
        {label}
      </span>
    </Link>
  );
}

function SideTab({
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
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-w-[3.15rem] flex-col items-center gap-1 px-1 pb-0.5 pt-1 text-[11px] tracking-wide transition active:scale-95"
      style={{
        color: active ? ACTIVE : INACTIVE,
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={22} filled={active} />
      <span className="leading-none">{label}</span>
    </Link>
  );
}
