"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/db/schema";
import type { LeadAiSummary } from "@/modules/leads/ai-summary";

export function LeadAiPanel({ lead, canUpdate }: { lead: Lead; canUpdate: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [adjustment, setAdjustment] = useState("0");
  const summary = lead.aiSummary as LeadAiSummary | null;

  async function regenerate() {
    setPending(true);
    const res = await fetch(`/api/leads/${lead.id}/summary`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not generate summary");
      return;
    }
    toast.success("Summary regenerated");
    router.refresh();
  }

  async function applyAdjustment() {
    const value = Number(adjustment);
    if (!Number.isFinite(value) || value < -30 || value > 30) {
      toast.error("Adjustment must be between -30 and 30");
      return;
    }
    setPending(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreAdjustment: value }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not adjust score");
      return;
    }
    toast.success("Score updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">AI lead summary</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={lead.score >= 70 ? "default" : lead.score >= 40 ? "secondary" : "outline"}>
            Score: {lead.score}
          </Badge>
          {canUpdate ? (
            <Button size="sm" variant="outline" onClick={regenerate} loading={pending}>
              {summary ? "Regenerate" : "Generate summary"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!summary ? (
          <p className="text-sm text-muted-foreground">
            No AI summary yet. {lead.conversationId ? "Generate one from the conversation transcript." : "This lead has no linked conversation to summarize."}
          </p>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Who</p>
              <p className="text-sm">{summary.whoIsThisPerson || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">What they need</p>
              <p className="text-sm">{summary.whatDoTheyNeed || "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Budget</p>
                <p className="text-sm">{summary.budget ?? "Not mentioned"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Timeline</p>
                <p className="text-sm">{summary.timeline ?? "Not mentioned"}</p>
              </div>
            </div>
            {summary.painPoints.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pain points</p>
                <ul className="list-inside list-disc text-sm">
                  {summary.painPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ) : null}
            {summary.productsDiscussed.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Products discussed</p>
                <div className="flex flex-wrap gap-1">
                  {summary.productsDiscussed.map((p, i) => <Badge key={i} variant="outline">{p}</Badge>)}
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Recommended next action</p>
              <p className="text-sm">{summary.recommendedNextAction || "—"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Generated {new Date(summary.generatedAt).toLocaleString()}</p>
          </>
        )}
        {canUpdate ? (
          <div className="flex items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">Manual score adjustment (-30 to +30)</span>
            <Input
              type="number"
              min={-30}
              max={30}
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="w-20"
            />
            <Button size="sm" variant="outline" onClick={applyAdjustment} loading={pending}>Apply</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
