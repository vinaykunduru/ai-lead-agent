"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createFirstOwnerSchema,
  type CreateFirstOwnerInput,
} from "@/modules/organizations/validation";
import { createFirstOwnerAction } from "../../actions";

export function CreateFirstOwnerForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFirstOwnerInput>({
    resolver: zodResolver(createFirstOwnerSchema),
    defaultValues: { organizationId },
  });

  async function onSubmit(values: CreateFirstOwnerInput) {
    const result = await createFirstOwnerAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invite sent");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create the first owner</CardTitle>
        <CardDescription>
          Sends an email invite. The recipient sets their own password and becomes this
          company&apos;s Owner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
          <input type="hidden" {...register("organizationId")} />
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName ? (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending invite..." : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
