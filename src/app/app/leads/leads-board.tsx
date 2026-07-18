"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import type { Lead, LeadStage } from "@/db/schema";
import type { AssignableTeamMember } from "@/modules/organizations/team-members";
import { PriorityBadge, ScoreBadge } from "./lead-badges";
import { CreateLeadDialog } from "./create-lead-dialog";
import { ManageStagesDialog } from "./manage-stages-dialog";

const ALL = "__all__";
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

type Props = {
  initialLeads: Lead[];
  stages: LeadStage[];
  teamMembers: AssignableTeamMember[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function LeadsBoard({ initialLeads, stages, teamMembers, canCreate, canUpdate }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [q, setQ] = useState("");
  const [stageId, setStageId] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [assignedUserId, setAssignedUserId] = useState(ALL);
  const [loading, setLoading] = useState(false);

  const emailByUserId = useMemo(() => new Map(teamMembers.map((m) => [m.userId, m.email])), [teamMembers]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (stageId !== ALL) params.set("stageId", stageId);
      if (priority !== ALL) params.set("priority", priority);
      if (assignedUserId !== ALL) params.set("assignedUserId", assignedUserId);

      setLoading(true);
      fetch(`/api/leads?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setLeads(data.leads ?? []))
        .catch(() => toast.error("Could not load leads"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, stageId, priority, assignedUserId]);

  async function moveStage(leadId: string, newStageId: string) {
    const res = await fetch(`/api/leads/${leadId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: newStageId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not move lead");
      return;
    }
    const { lead } = await res.json();
    setLeads((prev) => prev.map((l) => (l.id === leadId ? lead : l)));
  }

  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of leads) {
      const bucket = map.get(lead.stageId);
      if (bucket) bucket.push(lead);
      else map.set(lead.stageId, [lead]);
    }
    return map;
  }, [leads, stages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, company..."
            className="w-full sm:w-64"
          />
          <Select value={stageId} onValueChange={(v) => setStageId(v ?? ALL)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v ?? ALL)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignedUserId} onValueChange={(v) => setAssignedUserId(v ?? ALL)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Anyone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>{m.email ?? m.userId.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={view === "kanban" ? "secondary" : "ghost"}
              onClick={() => setView("kanban")}
            >
              Pipeline
            </Button>
            <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}>
              Table
            </Button>
          </div>
          {canUpdate ? <ManageStagesDialog stages={stages} /> : null}
          <Link href="/api/leads/export">
            <Button variant="outline" size="sm">Export CSV</Button>
          </Link>
          {canCreate ? <CreateLeadDialog stages={stages} /> : null}
        </div>
      </div>

      {leads.length === 0 && !loading ? (
        <EmptyState
          title="No leads match these filters"
          description="Leads appear here automatically from widget conversations, or you can add one manually."
          action={canCreate ? <CreateLeadDialog stages={stages} /> : undefined}
        />
      ) : view === "table" ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl border bg-card shadow-card transition-opacity duration-150",
            loading && "opacity-60",
          )}
          aria-busy={loading}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/app/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name ?? lead.email ?? lead.phone ?? "Unnamed lead"}
                    </Link>
                    {lead.company ? <p className="text-xs text-muted-foreground">{lead.company}</p> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{stageById.get(lead.stageId)?.name ?? "—"}</TableCell>
                  <TableCell><PriorityBadge priority={lead.priority} /></TableCell>
                  <TableCell><ScoreBadge score={lead.score} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.assignedUserId ? (emailByUserId.get(lead.assignedUserId) ?? "—") : "Unassigned"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.lastActivityAt.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div
          className={cn("flex gap-3 overflow-x-auto pb-2 transition-opacity duration-150", loading && "opacity-60")}
          aria-busy={loading}
        >
          {stages.map((stage) => (
            <Card key={stage.id} className="w-72 shrink-0" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{stage.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {leadsByStage.get(stage.id)?.length ?? 0}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(leadsByStage.get(stage.id) ?? []).map((lead) => (
                  <div key={lead.id} className="rounded-md border p-2.5">
                    <Link href={`/app/leads/${lead.id}`} className="text-sm font-medium hover:underline">
                      {lead.name ?? lead.email ?? lead.phone ?? "Unnamed lead"}
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5">
                      <PriorityBadge priority={lead.priority} />
                      <ScoreBadge score={lead.score} />
                    </div>
                    {canUpdate ? (
                      <Select value={stage.id} onValueChange={(v) => v && v !== stage.id && moveStage(lead.id, v)}>
                        <SelectTrigger size="sm" className="mt-2 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
