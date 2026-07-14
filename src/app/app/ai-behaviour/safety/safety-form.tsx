"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_SAFETY_FALLBACK_MESSAGE,
} from "@/modules/ai-behaviour/prompt-generator";
import { updateAiProfileSchema, type UpdateAiProfileInput } from "@/modules/ai-behaviour/validation";
import type { AiProfile } from "@/db/schema";

type FormValues = Pick<UpdateAiProfileInput, "safetyFallbackMessage">;

export function SafetyForm({ profile, canUpdate }: { profile: AiProfile; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(updateAiProfileSchema.pick({ safetyFallbackMessage: true })),
    defaultValues: {
      safetyFallbackMessage: profile.safetyFallbackMessage ?? "",
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
      toast.error(body.error ?? "Could not save safety settings");
      return;
    }
    toast.success("Safety settings updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>When information is missing</CardTitle>
        <p className="text-sm text-muted-foreground">
          The only configurable safety behaviour: what the AI says when it doesn&rsquo;t have an answer in
          the knowledge base. It will never invent one.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="safetyFallbackMessage">Fallback message</Label>
            <Textarea
              id="safetyFallbackMessage"
              rows={3}
              placeholder={DEFAULT_SAFETY_FALLBACK_MESSAGE}
              disabled={!canUpdate}
              {...register("safetyFallbackMessage")}
            />
            {errors.safetyFallbackMessage ? (
              <p className="text-sm text-destructive">{errors.safetyFallbackMessage.message}</p>
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
