"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/types";
import { cn } from "@/lib/utils";

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "概览" },
  { href: "/items", label: "器材" },
  { href: "/films", label: "照片" },
  { href: "/stats", label: "统计" }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/45 p-1 text-sm shadow-sm"
      aria-label="Main navigation"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
            isActive(pathname, item.href) && "bg-background text-foreground shadow-sm"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
