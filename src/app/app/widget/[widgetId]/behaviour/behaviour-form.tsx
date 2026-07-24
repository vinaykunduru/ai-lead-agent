"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpdateBehaviourInput } from "@/modules/widget/validation";
import type { WidgetSettings } from "@/db/schema";

type FormValues = Omit<UpdateBehaviourInput, "suggestedQuestions"> & {
  suggestedQuestions: { value: string }[];
};

const SESSION_TIMEOUT_PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "24 hours", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
  { label: "30 days", minutes: 43200 },
] as const;

export function BehaviourForm({
  widgetId,
  settings,
  canUpdate,
}: {
  widgetId: string;
  settings: WidgetSettings;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const initialSuggested = Array.isArray(settings.suggestedQuestions)
    ? (settings.suggestedQuestions as string[])
    : [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({
    // No zodResolver here: useFieldArray requires each list item to be an
    // object ({ value }), which doesn't match updateBehaviourSchema's flat
    // `string[]` shape. Client-side validation is a UX nicety, not the
    // security boundary — the API route re-validates with the real schema
    // regardless (CLAUDE.md: "validate at every API boundary").
    defaultValues: {
      welcomeMessage: settings.welcomeMessage ?? "",
      suggestedQuestions: initialSuggested.map((value) => ({ value })),
      showTypingIndicator: settings.showTypingIndicator,
      showBranding: settings.showBranding,
      offlineMessage: settings.offlineMessage ?? "",
      showTimestamp: settings.showTimestamp,
      showPoweredBy: settings.showPoweredBy,
      autoOpen: settings.autoOpen,
      autoOpenDelaySeconds: settings.autoOpenDelaySeconds,
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "suggestedQuestions" });
  const autoOpen = watch("autoOpen");

  async function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      suggestedQuestions: values.suggestedQuestions.map((q) => q.value).filter(Boolean),
    };
    const res = await fetch(`/api/widgets/${widgetId}/behaviour`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save behaviour");
      return;
    }
    toast.success("Behaviour updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Behaviour</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome message</Label>
            <Textarea id="welcomeMessage" rows={2} disabled={!canUpdate} {...register("welcomeMessage")} />
          </div>

          <div className="space-y-2">
            <Label>Suggested questions</Label>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input disabled={!canUpdate} {...register(`suggestedQuestions.${index}.value` as const)} />
                  {canUpdate ? (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {canUpdate && fields.length < 10 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })}>
                <Plus className="size-4" />
                Add question
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="offlineMessage">Offline message</Label>
            <Textarea id="offlineMessage" rows={2} disabled={!canUpdate} {...register("offlineMessage")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeoutMinutes">Conversation persistence</Label>
            <Select
              value={String(watch("sessionTimeoutMinutes") ?? 1440)}
              onValueChange={(v) => v && setValue("sessionTimeoutMinutes", Number(v), { shouldDirty: true })}
              disabled={!canUpdate}
            >
              <SelectTrigger id="sessionTimeoutMinutes" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TIMEOUT_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground">
              How long a visitor&apos;s conversation keeps going across page navigation and browser refresh before
              a new one starts.
            </p>
          </div>

          <div className="space-y-3">
            <ToggleRow
              label="Typing indicator"
              checked={watch("showTypingIndicator") ?? false}
              onCheckedChange={(v) => setValue("showTypingIndicator", v, { shouldDirty: true })}
              disabled={!canUpdate}
            />
            <ToggleRow
              label="Show branding"
              checked={watch("showBranding") ?? false}
              onCheckedChange={(v) => setValue("showBranding", v, { shouldDirty: true })}
              disabled={!canUpdate}
            />
            <ToggleRow
              label="Show timestamps"
              checked={watch("showTimestamp") ?? false}
              onCheckedChange={(v) => setValue("showTimestamp", v, { shouldDirty: true })}
              disabled={!canUpdate}
            />
            <ToggleRow
              label="Show &ldquo;Powered by&rdquo;"
              checked={watch("showPoweredBy") ?? false}
              onCheckedChange={(v) => setValue("showPoweredBy", v, { shouldDirty: true })}
              disabled={!canUpdate}
            />
            <ToggleRow
              label="Auto-open"
              checked={autoOpen ?? false}
              onCheckedChange={(v) => setValue("autoOpen", v, { shouldDirty: true })}
              disabled={!canUpdate}
            />
          </div>

          {autoOpen ? (
            <div className="space-y-2">
              <Label htmlFor="autoOpenDelaySeconds">Auto-open delay (seconds)</Label>
              <Input
                id="autoOpenDelaySeconds"
                type="number"
                className="w-32"
                disabled={!canUpdate}
                {...register("autoOpenDelaySeconds", { valueAsNumber: true })}
              />
            </div>
          ) : null}

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

function ToggleRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
