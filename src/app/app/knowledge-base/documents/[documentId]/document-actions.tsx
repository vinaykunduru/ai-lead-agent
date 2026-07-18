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

type Props = {
  documentId: string;
  status: string;
  canUpdate: boolean;
  canDelete: boolean;
  canReprocess: boolean;
};

export function DocumentActions({ documentId, status, canUpdate, canDelete, canReprocess }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reprocess() {
    setPending(true);
    const res = await fetch(`/api/knowledge/documents/${documentId}/reprocess`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not start reprocessing");
      return;
    }
    toast.success("Reprocessing started");
    router.refresh();
  }

  async function archive() {
    setPending(true);
    const res = await fetch(`/api/knowledge/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not archive document");
      return;
    }
    toast.success("Document archived");
    router.refresh();
  }

  async function softDelete() {
    setPending(true);
    const res = await fetch(`/api/knowledge/documents/${documentId}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete document");
      return;
    }
    toast.success("Document deleted");
    router.push("/app/knowledge-base");
  }

  return (
    <div className="flex gap-2">
      {canReprocess && (status === "ready" || status === "failed") ? (
        <Button variant="outline" size="sm" loading={pending} onClick={reprocess}>
          Reprocess
        </Button>
      ) : null}
      {canUpdate && status !== "archived" ? (
        <Button variant="outline" size="sm" loading={pending} onClick={archive}>
          Archive
        </Button>
      ) : null}
      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" loading={pending}>Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
              <AlertDialogDescription>
                It will be hidden from the knowledge base and excluded from search. This does not permanently
                erase it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={softDelete} loading={pending}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
