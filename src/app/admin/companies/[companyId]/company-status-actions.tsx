"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Organization } from "@/db/schema";
import { updateCompanyStatusAction } from "../actions";

export function CompanyStatusActions({ company }: { company: Organization }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(status: "trial" | "active" | "suspended") {
    setPending(true);
    const result = await updateCompanyStatusAction({ organizationId: company.id, status });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Company marked ${status}`);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {company.status !== "active" ? (
        <Button variant="outline" size="sm" loading={pending} onClick={() => setStatus("active")}>
          Activate
        </Button>
      ) : null}
      {company.status !== "suspended" ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm" loading={pending}>
                Suspend
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend {company.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                All users at this company will immediately lose access to their dashboard until
                the company is reactivated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => setStatus("suspended")} loading={pending}>
                Suspend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
