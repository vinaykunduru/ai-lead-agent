import Link from "next/link";
import { CheckCircle2, Circle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  icon: LucideIcon;
  href?: string;
};

/** Shared by the org-wide setup checklist and the per-widget deployment checklist. */
export function ChecklistList({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            {item.complete ? (
              <CheckCircle2 className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="size-4.5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
            )}
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-medium",
                  item.complete && "text-muted-foreground line-through decoration-1",
                )}
              >
                {item.label}
              </span>
              <span className="sr-only">{item.complete ? " — completed" : " — not started"}</span>
            </span>
          </>
        );

        return (
          <li key={item.id}>
            {!item.complete && item.href ? (
              <Link
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
