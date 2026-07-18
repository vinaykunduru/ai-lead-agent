"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// icon is a pre-rendered element (e.g. `<LayoutDashboard className="size-4" />`),
// not a component reference — a raw component type/forwardRef object isn't a
// serializable prop value across the Server Component -> Client Component
// boundary (this shell is "use client", but NAV_ITEMS is defined in the
// server-rendered layout.tsx files), while an already-instantiated JSX
// element is.
export type NavItem = { label: string; href: string; icon?: React.ReactNode };

function initialsFor(label: string) {
  const name = label.split("@")[0] ?? label;
  const parts = name.split(/[.\s_-]+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}

function BrandMark({ alt, badge, size }: { alt: string; badge?: string; size: "sm" | "default" }) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt={alt}
        width={140}
        height={44}
        priority
        className={size === "sm" ? "h-7 w-auto" : "h-8 w-auto"}
      />
      {badge ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-metadata font-medium text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function NavLinks({
  navItems,
  pathname,
  onNavigate,
  collapsed,
}: {
  navItems: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className="flex-1 space-y-0.5 p-3">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {isActive ? (
              <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
            ) : null}
            {item.icon}
            {collapsed ? null : <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileFooter({
  userLabel,
  signOutAction,
  collapsed,
}: {
  userLabel: string;
  signOutAction: () => Promise<void>;
  collapsed?: boolean;
}) {
  return (
    <div className="border-t p-3">
      <div className={cn("flex items-center gap-2.5 rounded-md px-1 py-1.5", collapsed && "justify-center px-0")}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-metadata font-semibold text-primary">
          {initialsFor(userLabel)}
        </span>
        {collapsed ? null : <span className="truncate text-caption text-muted-foreground">{userLabel}</span>}
      </div>
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          title={collapsed ? "Sign out" : undefined}
          className={cn("mt-1 w-full", collapsed ? "justify-center px-0" : "justify-start")}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {collapsed ? null : "Sign out"}
        </Button>
      </form>
    </div>
  );
}

export function DashboardShell({
  brand,
  badge,
  navItems,
  userLabel,
  signOutAction,
  children,
}: {
  brand: string;
  /** Context label shown next to the logo (e.g. "Admin") to distinguish this
   * shell from the company dashboard — omit for the default company shell. */
  badge?: string;
  navItems: NavItem[];
  userLabel: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // In-memory only (not persisted): reading a persisted preference during
  // the initial render would desync from the server-rendered markup and
  // cause a hydration mismatch, and syncing it in afterward via an effect
  // is exactly the setState-in-effect anti-pattern the React Compiler flags.
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar — the sidebar below is hidden under md, so this is
          the only way a small-viewport user sees the brand or opens nav. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:hidden">
        <BrandMark alt={brand} badge={badge} size="sm" />
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
              <BrandMark alt={brand} badge={badge} size="sm" />
            </div>
            <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            <ProfileFooter userLabel={userLabel} signOutAction={signOutAction} />
          </div>
        </div>
      ) : null}

      <aside
        className={cn(
          "hidden shrink-0 border-r bg-muted/20 transition-[width] duration-150 md:flex md:flex-col",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "px-6")}>
          {collapsed ? (
            <span
              role="img"
              aria-label={brand}
              title={brand}
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              B
            </span>
          ) : (
            <BrandMark alt={brand} badge={badge} size="default" />
          )}
        </div>
        <NavLinks navItems={navItems} pathname={pathname} collapsed={collapsed} />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
            className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start gap-2")}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {collapsed ? null : "Collapse"}
          </Button>
        </div>
        <ProfileFooter userLabel={userLabel} signOutAction={signOutAction} collapsed={collapsed} />
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
