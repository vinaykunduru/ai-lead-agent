"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CompanyDetailNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/admin/companies/${companyId}`;
  const items = [
    { label: "Overview", href: base },
    { label: "Users", href: `${base}/users` },
    { label: "Audit Logs", href: `${base}/audit-logs` },
  ];

  return (
    <nav className="flex gap-1 border-b px-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
