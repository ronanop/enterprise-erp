"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";



import { getAssetManagementNavItems } from "@/config/assets";

import { cn } from "@/lib/utils";



function isWorkspaceTabActive(pathname: string, href: string, match?: "exact" | "prefix"): boolean {

  if (href === "/assets" || match === "exact") {

    return pathname === href;

  }

  if (href === "/assets/assets") {

    return (

      pathname === href ||

      (pathname.startsWith(`${href}/`) && !pathname.startsWith("/assets/assets/new"))

    );

  }

  return pathname === href || pathname.startsWith(`${href}/`);

}



/** Secondary tabs — full Asset Management catalog (aligned with sidebar). */

export function AssetsWorkspaceNav() {

  const pathname = usePathname();

  const items = getAssetManagementNavItems();



  return (

    <nav aria-label="Assets workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">

      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">

        {items.map((item) => {

          const active = isWorkspaceTabActive(pathname, item.href, item.match);

          return (

            <li key={item.href}>

              <Link

                href={item.href}

                className={cn(

                  "inline-flex h-8 cursor-pointer items-center rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",

                  active

                    ? "border-b-2 border-primary text-foreground"

                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",

                )}

              >

                {item.title}

              </Link>

            </li>

          );

        })}

      </ul>

    </nav>

  );

}


