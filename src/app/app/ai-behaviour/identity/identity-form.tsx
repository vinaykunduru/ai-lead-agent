"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateAiProfileSchema, type UpdateAiProfileInput } from "@/modules/ai-behaviour/validation";
import type { AiProfile } from "@/db/schema";

type FormValues = Pick<UpdateAiProfileInput, "assistantName" | "assistantDescription" | "companySummary" | "role">;

export function IdentityForm({ profile, canUpdate }: { profile: AiProfile; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(updateAiProfileSchema.pick({
      assistantName: true,
      assistantDescription: true,
      companySummary: true,
      role: true,
    })),
    defaultValues: {
      assistantName: profile.assistantName,
      assistantDescription: profile.assistantDescription ?? "",
      companySummary: profile.companySummary ?? "",
      role: profile.role ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/ai-behaviour/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save identity settings");
      return;
    }
    toast.success("Identity updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Identity</CardTitle>
        <p className="text-sm text-muted-foreground">Who your AI Assistant is, in its own words.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="assistantName">Assistant name</Label>
            <Input id="assistantName" disabled={!canUpdate} {...register("assistantName")} />
            {errors.assistantName ? (
              <p className="text-sm text-destructive">{errors.assistantName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              placeholder="e.g. Sales Assistant"
              disabled={!canUpdate}
              {...register("role")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assistantDescription">Assistant description</Label>
            <Textarea
              id="assistantDescription"
              rows={3}
              placeholder='"I am Bloom AI. I help visitors understand our products and schedule meetings."'
              disabled={!canUpdate}
              {...register("assistantDescription")}
            />
            {errors.assistantDescription ? (
              <p className="text-sm text-destructive">{errors.assistantDescription.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="companySummary">Company summary</Label>
            <Textarea
              id="companySummary"
              rows={4}
              placeholder="A short summary of what your company does, for the AI to reference."
              disabled={!canUpdate}
              {...register("companySummary")}
            />
            {errors.companySummary ? (
              <p className="text-sm text-destructive">{errors.companySummary.message}</p>
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
