"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateAiProfileSchema, type UpdateAiProfileInput } from "@/modules/ai-behaviour/validation";
import type { AiProfile } from "@/db/schema";

type FormValues = Pick<
  UpdateAiProfileInput,
  "primaryLanguage" | "supportedLanguages" | "autoDetectLanguage" | "fallbackLanguage"
>;

export function LanguageForm({ profile, canUpdate }: { profile: AiProfile; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(
      updateAiProfileSchema.pick({
        primaryLanguage: true,
        supportedLanguages: true,
        autoDetectLanguage: true,
        fallbackLanguage: true,
      }),
    ),
    defaultValues: {
      primaryLanguage: profile.primaryLanguage,
      supportedLanguages: Array.isArray(profile.supportedLanguages)
        ? (profile.supportedLanguages as string[])
        : [profile.primaryLanguage],
      autoDetectLanguage: profile.autoDetectLanguage,
      fallbackLanguage: profile.fallbackLanguage,
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
      toast.error(body.error ?? "Could not save language settings");
      return;
    }
    toast.success("Language settings updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Language</CardTitle>
        <p className="text-sm text-muted-foreground">
          Which languages your AI Assistant can respond in, using ISO codes (e.g. en, es, fr).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="primaryLanguage">Primary language</Label>
            <Input id="primaryLanguage" placeholder="en" disabled={!canUpdate} {...register("primaryLanguage")} />
            {errors.primaryLanguage ? (
              <p className="text-sm text-destructive">{errors.primaryLanguage.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportedLanguages">Supported languages</Label>
            <Controller
              control={control}
              name="supportedLanguages"
              render={({ field }) => (
                <Input
                  id="supportedLanguages"
                  placeholder="en, es, fr"
                  disabled={!canUpdate}
                  value={(field.value ?? []).join(", ")}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((code) => code.trim())
                        .filter(Boolean),
                    )
                  }
                />
              )}
            />
            {errors.supportedLanguages ? (
              <p className="text-sm text-destructive">{errors.supportedLanguages.message}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="autoDetectLanguage">Automatically detect visitor language</Label>
            <Controller
              control={control}
              name="autoDetectLanguage"
              render={({ field }) => (
                <Switch
                  id="autoDetectLanguage"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canUpdate}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fallbackLanguage">Fallback language</Label>
            <Input
              id="fallbackLanguage"
              placeholder="en"
              disabled={!canUpdate}
              {...register("fallbackLanguage")}
            />
            {errors.fallbackLanguage ? (
              <p className="text-sm text-destructive">{errors.fallbackLanguage.message}</p>
            ) : null}
          </div>

          {canUpdate ? (
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
