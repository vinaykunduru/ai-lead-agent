"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  COLOR_SCHEMES,
  LAUNCHER_POSITIONS,
  updateAppearanceSchema,
  type UpdateAppearanceInput,
} from "@/modules/widget/validation";
import type { WidgetTheme } from "@/db/schema";

export function AppearanceForm({
  widgetId,
  theme,
  canUpdate,
}: {
  widgetId: string;
  theme: WidgetTheme;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateAppearanceInput>({
    resolver: zodResolver(updateAppearanceSchema),
    defaultValues: {
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      launcherPosition: theme.launcherPosition,
      launcherIcon: theme.launcherIcon ?? "",
      borderRadius: theme.borderRadius,
      colorScheme: theme.colorScheme,
      font: theme.font,
      logoUrl: theme.logoUrl ?? "",
      avatarUrl: theme.avatarUrl ?? "",
      widgetWidth: theme.widgetWidth,
      widgetHeight: theme.widgetHeight,
    },
  });

  async function onSubmit(values: UpdateAppearanceInput) {
    const res = await fetch(`/api/widgets/${widgetId}/appearance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save appearance");
      return;
    }
    toast.success("Appearance updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-9 rounded border"
                  value={watch("primaryColor") || "#4F46E5"}
                  onChange={(e) => setValue("primaryColor", e.target.value, { shouldDirty: true })}
                  disabled={!canUpdate}
                />
                <Input id="primaryColor" disabled={!canUpdate} {...register("primaryColor")} />
              </div>
              {errors.primaryColor ? (
                <p className="text-sm text-destructive">{errors.primaryColor.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-9 rounded border"
                  value={watch("accentColor") || "#22C55E"}
                  onChange={(e) => setValue("accentColor", e.target.value, { shouldDirty: true })}
                  disabled={!canUpdate}
                />
                <Input id="accentColor" disabled={!canUpdate} {...register("accentColor")} />
              </div>
              {errors.accentColor ? (
                <p className="text-sm text-destructive">{errors.accentColor.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="launcherPosition">Launcher position</Label>
              <Select
                value={watch("launcherPosition")}
                onValueChange={(v) => setValue("launcherPosition", v as UpdateAppearanceInput["launcherPosition"], { shouldDirty: true })}
              >
                <SelectTrigger id="launcherPosition" className="w-full" disabled={!canUpdate}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAUNCHER_POSITIONS.map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="colorScheme">Color scheme</Label>
              <Select
                value={watch("colorScheme")}
                onValueChange={(v) => setValue("colorScheme", v as UpdateAppearanceInput["colorScheme"], { shouldDirty: true })}
              >
                <SelectTrigger id="colorScheme" className="w-full" disabled={!canUpdate}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_SCHEMES.map((scheme) => (
                    <SelectItem key={scheme} value={scheme}>
                      {scheme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="borderRadius">Border radius (px)</Label>
              <Input
                id="borderRadius"
                type="number"
                disabled={!canUpdate}
                {...register("borderRadius", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font">Font</Label>
              <Input id="font" disabled={!canUpdate} {...register("font")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="widgetWidth">Width (px)</Label>
              <Input
                id="widgetWidth"
                type="number"
                disabled={!canUpdate}
                {...register("widgetWidth", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="widgetHeight">Height (px)</Label>
              <Input
                id="widgetHeight"
                type="number"
                disabled={!canUpdate}
                {...register("widgetHeight", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="launcherIcon">Launcher icon URL (optional)</Label>
            <Input id="launcherIcon" disabled={!canUpdate} {...register("launcherIcon")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input id="logoUrl" disabled={!canUpdate} {...register("logoUrl")} />
            {errors.logoUrl ? <p className="text-sm text-destructive">{errors.logoUrl.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
            <Input id="avatarUrl" disabled={!canUpdate} {...register("avatarUrl")} />
            {errors.avatarUrl ? <p className="text-sm text-destructive">{errors.avatarUrl.message}</p> : null}
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
