"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateWidgetSchema, type UpdateWidgetInput } from "@/modules/widget/validation";
import type { Widget } from "@/db/schema";

type FormValues = Pick<UpdateWidgetInput, "name" | "description" | "defaultLanguage">;

export function GeneralForm({
  widget,
  canUpdate,
  canPublish,
  canDelete,
}: {
  widget: Widget;
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [statusPending, setStatusPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(
      updateWidgetSchema.pick({ name: true, description: true, defaultLanguage: true }),
    ),
    defaultValues: {
      name: widget.name,
      description: widget.description ?? "",
      defaultLanguage: widget.defaultLanguage,
    },
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch(`/api/widgets/${widget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save changes");
      return;
    }
    toast.success("Widget updated");
    router.refresh();
  }

  async function setStatus(status: "active" | "disabled") {
    setStatusPending(true);
    const res = await fetch(`/api/widgets/${widget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setStatusPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not update widget");
      return;
    }
    toast.success(status === "active" ? "Widget enabled" : "Widget disabled");
    router.refresh();
  }

  async function deleteWidget() {
    const res = await fetch(`/api/widgets/${widget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete widget");
      return;
    }
    toast.success("Widget deleted");
    router.push("/app/widget");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="widget-name">Name</Label>
              <Input id="widget-name" disabled={!canUpdate} {...register("name")} />
              {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-description">Description</Label>
              <Textarea id="widget-description" rows={3} disabled={!canUpdate} {...register("description")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="widget-language">Default language</Label>
              <Input
                id="widget-language"
                className="w-32"
                disabled={!canUpdate}
                {...register("defaultLanguage")}
              />
            </div>
            {canUpdate ? (
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {canPublish || canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canPublish && widget.status !== "active" && widget.status !== "archived" ? (
              <Button variant="outline" disabled={statusPending} onClick={() => setStatus("active")}>
                Enable widget
              </Button>
            ) : null}
            {canPublish && widget.status === "active" ? (
              <Button variant="outline" disabled={statusPending} onClick={() => setStatus("disabled")}>
                Disable widget
              </Button>
            ) : null}
            {canDelete && widget.status !== "archived" ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline">Delete widget</Button>} />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this widget?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It will stop loading on any site using its installation snippet. This does not
                      permanently erase it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteWidget}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
