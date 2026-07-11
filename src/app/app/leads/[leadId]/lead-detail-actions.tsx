"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, LeadStage } from "@/db/schema";
import type { AssignableTeamMember } from "@/modules/organizations/team-members";

const UNASSIGNED = "__unassigned__";
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

type Props = {
  lead: Lead;
  stages: LeadStage[];
  teamMembers: AssignableTeamMember[];
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
};

export function LeadDetailActions({ lead, stages, teamMembers, canUpdate, canAssign, canDelete }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function changeStage(stageId: string) {
    setPending(true);
    const res = await fetch(`/api/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not change stage");
      return;
    }
    router.refresh();
  }

  async function changePriority(priority: string) {
    setPending(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not change priority");
      return;
    }
    router.refresh();
  }

  async function changeAssignee(userId: string) {
    setPending(true);
    const res = await fetch(`/api/leads/${lead.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId === UNASSIGNED ? null : userId }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not reassign lead");
      return;
    }
    router.refresh();
  }

  async function deleteLead() {
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete lead");
      return;
    }
    toast.success("Lead deleted");
    router.push("/app/leads");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Stage</Label>
          <Select value={lead.stageId} onValueChange={(v) => v && changeStage(v)} disabled={!canUpdate || pending}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={lead.priority} onValueChange={(v) => v && changePriority(v)} disabled={!canUpdate || pending}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assigned to</Label>
          <Select
            value={lead.assignedUserId ?? UNASSIGNED}
            onValueChange={(v) => v && changeAssignee(v)}
            disabled={!canAssign || pending}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>{m.email ?? m.userId.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <dl className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><dt>Source</dt><dd className="capitalize">{lead.source}</dd></div>
          <div className="flex justify-between"><dt>Created</dt><dd>{lead.createdAt.toLocaleDateString()}</dd></div>
          <div className="flex justify-between"><dt>Last activity</dt><dd>{lead.lastActivityAt.toLocaleString()}</dd></div>
        </dl>
        {canDelete ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" size="sm" className="w-full">Delete lead</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the lead and its notes, tags, and history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={deleteLead}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
