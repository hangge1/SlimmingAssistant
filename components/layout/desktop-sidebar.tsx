"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-[var(--border-soft)] bg-[var(--surface-panel)] px-4 py-6 md:block">
      <div className="mb-7 text-[17px] font-bold text-[var(--ink-primary)]">跑步瘦身助手</div>
      <nav aria-label="主导航" className="grid gap-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex min-h-10 items-center gap-2 rounded-md bg-[var(--motion-soft)] px-3 text-sm font-semibold text-[var(--primary)]"
                  : "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)]"
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
