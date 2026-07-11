import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadActivityEntry } from "@/db/schema";

const TYPE_LABELS: Record<LeadActivityEntry["type"], string> = {
  lead_created: "Lead created",
  lead_updated: "Lead updated",
  stage_changed: "Stage changed",
  assigned: "Assigned",
  note_added: "Note added",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  summary_generated: "AI summary generated",
  score_updated: "Score updated",
  escalated: "Escalated to a human",
  takeover_started: "Human takeover started",
  takeover_ended: "Resumed by AI",
};

function describeMetadata(entry: LeadActivityEntry): string | null {
  const metadata = entry.metadata as Record<string, unknown>;
  switch (entry.type) {
    case "stage_changed":
      return typeof metadata.toStage === "string" ? `→ ${metadata.toStage}` : null;
    case "tag_added":
    case "tag_removed":
      return typeof metadata.tag === "string" ? metadata.tag : null;
    case "score_updated":
      return typeof metadata.totalScore === "number" ? `New score: ${metadata.totalScore}` : null;
    case "note_added":
      return typeof metadata.preview === "string" ? metadata.preview : null;
    default:
      return null;
  }
}

/** Unified activity feed (module spec §10) — every lead-mutating service
 * writes one row here in the same transaction, so this is a single indexed
 * read rather than a UNION across notes/tags/assignments/stage history. */
export function LeadTimeline({ activity }: { activity: LeadActivityEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="space-y-3">
            {activity.map((entry) => {
              const detail = describeMetadata(entry);
              return (
                <li key={entry.id} className="border-l-2 pl-3 text-sm">
                  <p className="font-medium">{TYPE_LABELS[entry.type]}</p>
                  {detail ? <p className="text-muted-foreground">{detail}</p> : null}
                  <p className="text-xs text-muted-foreground">{entry.createdAt.toLocaleString()}</p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
