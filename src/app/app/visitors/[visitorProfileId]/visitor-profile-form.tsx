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
import { updateVisitorProfileSchema, type UpdateVisitorProfileInput } from "@/modules/visitor-profiles/validation";
import type { VisitorProfile } from "@/db/schema";

type FormValues = UpdateVisitorProfileInput;

const TEXT_FIELDS: { key: keyof FormValues; label: string; placeholder?: string }[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "designation", label: "Designation" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "interestedService", label: "Interested service" },
  { key: "budget", label: "Budget", placeholder: "e.g. $5,000/month" },
  { key: "timeline", label: "Timeline", placeholder: "e.g. Next quarter" },
  { key: "teamSize", label: "Team size" },
  { key: "currentSolution", label: "Current solution" },
  { key: "preferredContactTime", label: "Preferred contact time" },
];

/**
 * The one editable surface for a Visitor Profile (module spec: Admin Panel
 * enhancements — "editable, highlight missing info"). Conversation Detail,
 * Inbox Detail, and Lead Detail all link here rather than each growing its
 * own inline edit form for the same underlying record.
 */
export function VisitorProfileForm({ profile, canUpdate }: { profile: VisitorProfile; canUpdate: boolean }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(updateVisitorProfileSchema),
    defaultValues: Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, profile[f.key] ?? ""])) as FormValues,
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch(`/api/visitor-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save visitor profile");
      return;
    }
    toast.success("Visitor profile updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Visitor profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  disabled={!canUpdate}
                  {...register(field.key)}
                />
                {errors[field.key] ? (
                  <p className="text-sm text-destructive">{errors[field.key]?.message as string}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="requirement">Requirement</Label>
            <Textarea id="requirement" rows={3} disabled={!canUpdate} {...register("requirement")} />
            {errors.requirement ? <p className="text-sm text-destructive">{errors.requirement.message}</p> : null}
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
