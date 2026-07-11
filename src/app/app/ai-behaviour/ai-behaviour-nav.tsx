"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "Overview", href: "/app/ai-behaviour" },
  { label: "Identity", href: "/app/ai-behaviour/identity" },
  { label: "Personality", href: "/app/ai-behaviour/personality" },
  { label: "Language", href: "/app/ai-behaviour/language" },
  { label: "Lead Qualification", href: "/app/ai-behaviour/lead-qualification" },
  { label: "Business Rules", href: "/app/ai-behaviour/business-rules" },
  { label: "Business Hours", href: "/app/ai-behaviour/business-hours" },
  { label: "Handoff", href: "/app/ai-behaviour/handoff" },
  { label: "Safety", href: "/app/ai-behaviour/safety" },
  { label: "Playground", href: "/app/ai-behaviour/playground" },
];

export function AiBehaviourNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-6 py-2">
      {SECTIONS.map((section) => {
        const isActive =
          section.href === "/app/ai-behaviour"
            ? pathname === section.href
            : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
