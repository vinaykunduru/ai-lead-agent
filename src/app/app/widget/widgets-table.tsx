"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/shared/components/empty-state";
import type { Widget } from "@/db/schema";
import { WidgetStatusBadge } from "./status-badges";
import { CreateWidgetDialog } from "./create-widget-dialog";

type Props = {
  widgets: Widget[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
};

export function WidgetsTable({ widgets, canCreate, canDelete, canPublish }: Props) {
  const router = useRouter();

  async function setStatus(widgetId: string, status: "active" | "disabled") {
    const res = await fetch(`/api/widgets/${widgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not update widget");
      return;
    }
    toast.success(status === "active" ? "Widget enabled" : "Widget disabled");
    router.refresh();
  }

  async function archive(widgetId: string) {
    const res = await fetch(`/api/widgets/${widgetId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete widget");
      return;
    }
    toast.success("Widget deleted");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {widgets.length} widget{widgets.length === 1 ? "" : "s"}
        </h2>
        {canCreate ? <CreateWidgetDialog /> : null}
      </div>

      {widgets.length === 0 ? (
        <EmptyState
          title="No widgets yet"
          description="Create a widget to get an installation snippet for your website."
          action={canCreate ? <CreateWidgetDialog /> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Default language</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {widgets.map((widget) => (
              <TableRow key={widget.id}>
                <TableCell className="max-w-xs truncate">
                  <Link href={`/app/widget/${widget.id}`} className="font-medium hover:underline">
                    {widget.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <WidgetStatusBadge status={widget.status} />
                </TableCell>
                <TableCell className="text-muted-foreground uppercase">
                  {widget.defaultLanguage}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {widget.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/app/widget/${widget.id}`)}>
                        View details
                      </DropdownMenuItem>
                      {canPublish && widget.status !== "active" && widget.status !== "archived" ? (
                        <DropdownMenuItem onClick={() => setStatus(widget.id, "active")}>
                          Enable
                        </DropdownMenuItem>
                      ) : null}
                      {canPublish && widget.status === "active" ? (
                        <DropdownMenuItem onClick={() => setStatus(widget.id, "disabled")}>
                          Disable
                        </DropdownMenuItem>
                      ) : null}
                      {canDelete && widget.status !== "archived" ? (
                        <DropdownMenuItem variant="destructive" onClick={() => archive(widget.id)}>
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
