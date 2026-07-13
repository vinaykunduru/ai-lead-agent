"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NavItem = { label: string; href: string };

function NavLinks({ navItems, pathname, onNavigate }: { navItems: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  brand,
  navItems,
  userLabel,
  signOutAction,
  children,
}: {
  brand: string;
  navItems: NavItem[];
  userLabel: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar — the sidebar below is hidden under md, so this is
          the only way a small-viewport user sees the brand or opens nav. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:hidden">
        <span className="text-sm font-semibold tracking-tight">{brand}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileNavOpen((value) => !value)}
        >
          {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex h-14 items-center border-b px-4">
              <span className="text-sm font-semibold tracking-tight">{brand}</span>
            </div>
            <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            <div className="border-t p-3">
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="truncate text-xs text-muted-foreground">{userLabel}</span>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-sm font-semibold tracking-tight">{brand}</span>
        </div>
        <NavLinks navItems={navItems} pathname={pathname} />
        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="truncate text-xs text-muted-foreground">{userLabel}</span>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
