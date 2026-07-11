"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "Overview", href: "/app/analytics" },
  { label: "Conversations", href: "/app/analytics/conversations" },
  { label: "Leads", href: "/app/analytics/leads" },
  { label: "AI Performance", href: "/app/analytics/ai" },
  { label: "Knowledge", href: "/app/analytics/knowledge" },
  { label: "Inbox", href: "/app/analytics/inbox" },
  { label: "Widgets", href: "/app/analytics/widgets" },
  { label: "Alerts", href: "/app/analytics/alerts" },
];

export function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-6 py-2">
      {SECTIONS.map((section) => {
        const isActive = section.href === "/app/analytics" ? pathname === section.href : pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
