import Link from "next/link";
import { cn } from "@/lib/utils";
import { INBOX_VIEWS, type InboxQuery } from "@/modules/leads/validation";

const VIEW_LABELS: Record<InboxQuery["view"], string> = {
  all: "All",
  assigned_to_me: "Assigned to me",
  unassigned: "Unassigned",
  unread: "Unread",
  needs_reply: "Needs reply",
  escalated: "Escalated",
  closed: "Closed",
};

export function InboxTabs({ activeView }: { activeView: InboxQuery["view"] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-6 py-2">
      {INBOX_VIEWS.map((view) => (
        <Link
          key={view}
          href={`/app/inbox?view=${view}`}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === activeView
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {VIEW_LABELS[view]}
        </Link>
      ))}
    </nav>
  );
}
