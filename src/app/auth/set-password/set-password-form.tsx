"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setPasswordSchema, type SetPasswordInput } from "@/shared/validation/auth";
import { setPasswordAction } from "./actions";

export function SetPasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordInput>({ resolver: zodResolver(setPasswordSchema) });

  async function onSubmit(values: SetPasswordInput) {
    setFormError(null);
    const result = await setPasswordAction(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // Root resolver sends the now-authenticated user to /admin or /app.
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your password</CardTitle>
        <CardDescription>Choose a password to finish setting up your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Set password & continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
