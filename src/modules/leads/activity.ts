import "server-only";
import type { RlsDb } from "@/db/client";
import { leadActivity } from "@/db/schema";

/**
 * Every lead-mutating service function calls this inside the same RLS
 * transaction as its own write, so the Lead Detail timeline (module spec
 * §10) is one indexed query instead of a UNION across 5 tables. `metadata`
 * must stay small and safe — see db/schema/lead-activity.ts's doc comment.
 */
export async function recordActivity(
  tx: RlsDb,
  entry: {
    organizationId: string;
    leadId: string;
    type:
      | "lead_created"
      | "lead_updated"
      | "stage_changed"
      | "assigned"
      | "note_added"
      | "tag_added"
      | "tag_removed"
      | "summary_generated"
      | "score_updated"
      | "escalated"
      | "takeover_started"
      | "takeover_ended";
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(leadActivity).values({
    organizationId: entry.organizationId,
    leadId: entry.leadId,
    type: entry.type,
    actorUserId: entry.actorUserId ?? null,
    metadata: entry.metadata ?? {},
  });
}
