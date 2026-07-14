"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateHandoffSettingsSchema, type UpdateHandoffSettingsInput } from "@/modules/ai-behaviour/validation";
import type { AiHandoffSettings } from "@/db/schema";

export function HandoffForm({ handoff, canUpdate }: { handoff: AiHandoffSettings; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateHandoffSettingsInput>({
    resolver: zodResolver(updateHandoffSettingsSchema),
    defaultValues: {
      escalationEnabled: handoff.escalationEnabled,
      escalationEmail: handoff.escalationEmail ?? "",
      escalationMessage: handoff.escalationMessage ?? "",
      manualReviewRequired: handoff.manualReviewRequired,
      maxAiAttempts: handoff.maxAiAttempts,
    },
  });

  const escalationEnabled = watch("escalationEnabled");

  async function onSubmit(values: UpdateHandoffSettingsInput) {
    const res = await fetch("/api/ai-behaviour/handoff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save handoff settings");
      return;
    }
    toast.success("Handoff settings updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Human handoff</CardTitle>
        <p className="text-sm text-muted-foreground">
          This configures escalation only — routing conversations to a human happens in a later phase.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="flex items-center justify-between">
            <Label htmlFor="escalationEnabled">Escalation enabled</Label>
            <Controller
              control={control}
              name="escalationEnabled"
              render={({ field }) => (
                <Switch
                  id="escalationEnabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canUpdate}
                />
              )}
            />
          </div>

          {escalationEnabled ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="escalationEmail">Escalation email</Label>
                <Input
                  id="escalationEmail"
                  type="email"
                  placeholder="support@company.com"
                  disabled={!canUpdate}
                  {...register("escalationEmail")}
                />
                {errors.escalationEmail ? (
                  <p className="text-sm text-destructive">{errors.escalationEmail.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalationMessage">Escalation message</Label>
                <Textarea
                  id="escalationMessage"
                  rows={3}
                  placeholder="Shown to the visitor when a conversation is escalated."
                  disabled={!canUpdate}
                  {...register("escalationMessage")}
                />
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between">
            <Label htmlFor="manualReviewRequired">Manual review required before sending</Label>
            <Controller
              control={control}
              name="manualReviewRequired"
              render={({ field }) => (
                <Switch
                  id="manualReviewRequired"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canUpdate}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAiAttempts">Maximum AI attempts before escalating</Label>
            <Input
              id="maxAiAttempts"
              type="number"
              min={1}
              max={10}
              disabled={!canUpdate}
              {...register("maxAiAttempts", { valueAsNumber: true })}
            />
            {errors.maxAiAttempts ? (
              <p className="text-sm text-destructive">{errors.maxAiAttempts.message}</p>
            ) : null}
          </div>

          {canUpdate ? (
            <Button type="submit" disabled={!isDirty} loading={isSubmitting}>
              Save changes
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
