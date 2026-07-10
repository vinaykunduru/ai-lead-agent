"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanySchema, type UpdateCompanyInput } from "@/modules/organizations/validation";
import type { Organization } from "@/db/schema";
import { updateCompanyAction } from "../actions";

export function CompanyOverviewForm({ company }: { company: Organization }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateCompanyInput>({
    resolver: zodResolver(updateCompanySchema),
    defaultValues: {
      organizationId: company.id,
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      timezone: company.timezone,
    },
  });

  async function onSubmit(values: UpdateCompanyInput) {
    const result = await updateCompanyAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Company updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4" noValidate>
      <input type="hidden" {...register("organizationId")} />
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" {...register("website")} />
        {errors.website ? (
          <p className="text-sm text-destructive">{errors.website.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Input id="industry" {...register("industry")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" {...register("timezone")} />
        {errors.timezone ? (
          <p className="text-sm text-destructive">{errors.timezone.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
