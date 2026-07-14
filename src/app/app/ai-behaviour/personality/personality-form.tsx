"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERSONALITY_TYPES,
  RESPONSE_DETAIL_LEVELS,
  EMOJI_USAGE_LEVELS,
  updateAiProfileSchema,
  type UpdateAiProfileInput,
} from "@/modules/ai-behaviour/validation";
import { PROMPT_RENDERER_IDS, type PromptRendererId } from "@/modules/ai-behaviour/rendering";
import type { AiProfile } from "@/db/schema";

const FIELDS = [
  "personalityType",
  "customPersonalityDescription",
  "responseStyle",
  "communicationPreferences",
  "maxResponseLength",
  "responseDetail",
  "emojiUsage",
  "markdownEnabled",
  "bulletListPreference",
  "askFollowUpQuestions",
  "oneQuestionAtATime",
  "alwaysConcise",
  "aiProvider",
] as const;

const PROVIDER_LABELS: Record<PromptRendererId, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  llama: "Llama",
};

type FormValues = Pick<UpdateAiProfileInput, (typeof FIELDS)[number]>;

const PERSONALITY_LABELS: Record<string, string> = {
  professional: "Professional",
  friendly: "Friendly",
  technical: "Technical",
  luxury: "Luxury",
  healthcare: "Healthcare",
  legal: "Legal",
  sales: "Sales",
  custom: "Custom",
};

export function PersonalityForm({ profile, canUpdate }: { profile: AiProfile; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(updateAiProfileSchema.pick(Object.fromEntries(FIELDS.map((f) => [f, true])) as never)),
    defaultValues: {
      personalityType: profile.personalityType,
      customPersonalityDescription: profile.customPersonalityDescription ?? "",
      responseStyle: profile.responseStyle ?? "",
      communicationPreferences: profile.communicationPreferences ?? "",
      maxResponseLength: profile.maxResponseLength,
      responseDetail: profile.responseDetail,
      emojiUsage: profile.emojiUsage,
      markdownEnabled: profile.markdownEnabled,
      bulletListPreference: profile.bulletListPreference,
      askFollowUpQuestions: profile.askFollowUpQuestions,
      oneQuestionAtATime: profile.oneQuestionAtATime,
      alwaysConcise: profile.alwaysConcise,
      aiProvider: profile.aiProvider,
    },
  });

  const personalityType = watch("personalityType");

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/ai-behaviour/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save personality settings");
      return;
    }
    toast.success("Personality updated");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personality</CardTitle>
          <p className="text-sm text-muted-foreground">How your AI Assistant comes across to visitors.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="personalityType">Personality type</Label>
              <Controller
                control={control}
                name="personalityType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? field.value)} disabled={!canUpdate}>
                    <SelectTrigger id="personalityType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONALITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PERSONALITY_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiProvider">AI provider</Label>
              <Controller
                control={control}
                name="aiProvider"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? field.value)} disabled={!canUpdate}>
                    <SelectTrigger id="aiProvider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMPT_RENDERER_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {PROVIDER_LABELS[id]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Which AI provider the Conversation Engine uses to generate replies for this widget.
              </p>
            </div>

            {personalityType === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="customPersonalityDescription">Custom personality description</Label>
                <Textarea
                  id="customPersonalityDescription"
                  rows={3}
                  disabled={!canUpdate}
                  {...register("customPersonalityDescription")}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="responseStyle">Response style</Label>
              <Input
                id="responseStyle"
                placeholder="e.g. warm but efficient"
                disabled={!canUpdate}
                {...register("responseStyle")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationPreferences">Communication preferences</Label>
              <Textarea
                id="communicationPreferences"
                rows={3}
                placeholder="Any notes on tone, phrasing, or things to always/never say."
                disabled={!canUpdate}
                {...register("communicationPreferences")}
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium">Response settings</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxResponseLength">Maximum response length (characters)</Label>
                  <Input
                    id="maxResponseLength"
                    type="number"
                    min={50}
                    max={4000}
                    disabled={!canUpdate}
                    {...register("maxResponseLength", { valueAsNumber: true })}
                  />
                  {errors.maxResponseLength ? (
                    <p className="text-sm text-destructive">{errors.maxResponseLength.message}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responseDetail">Response detail</Label>
                    <Controller
                      control={control}
                      name="responseDetail"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? field.value)} disabled={!canUpdate}>
                          <SelectTrigger id="responseDetail" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESPONSE_DETAIL_LEVELS.map((level) => (
                              <SelectItem key={level} value={level} className="capitalize">
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emojiUsage">Emoji usage</Label>
                    <Controller
                      control={control}
                      name="emojiUsage"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? field.value)} disabled={!canUpdate}>
                          <SelectTrigger id="emojiUsage" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMOJI_USAGE_LEVELS.map((level) => (
                              <SelectItem key={level} value={level} className="capitalize">
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {(
                  [
                    ["markdownEnabled", "Markdown enabled"],
                    ["bulletListPreference", "Prefer bullet lists"],
                    ["askFollowUpQuestions", "Ask follow-up questions"],
                    ["oneQuestionAtATime", "One question at a time"],
                    ["alwaysConcise", "Always remain concise"],
                  ] as const
                ).map(([name, label]) => (
                  <div key={name} className="flex items-center justify-between">
                    <Label htmlFor={name}>{label}</Label>
                    <Controller
                      control={control}
                      name={name}
                      render={({ field }) => (
                        <Switch
                          id={name}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!canUpdate}
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {canUpdate ? (
              <Button type="submit" disabled={!isDirty} loading={isSubmitting}>
                Save changes
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
