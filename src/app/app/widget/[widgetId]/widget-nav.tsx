"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function WidgetNav({ widgetId }: { widgetId: string }) {
  const pathname = usePathname();
  const base = `/app/widget/${widgetId}`;
  const sections = [
    { label: "General", href: base },
    { label: "Appearance", href: `${base}/appearance` },
    { label: "Behaviour", href: `${base}/behaviour` },
    { label: "Domains", href: `${base}/domains` },
    { label: "Installation", href: `${base}/installation` },
    { label: "Preview", href: `${base}/preview` },
    { label: "Keys", href: `${base}/keys` },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-6 py-2">
      {sections.map((section) => {
        const isActive = section.href === base ? pathname === base : pathname.startsWith(section.href);
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
