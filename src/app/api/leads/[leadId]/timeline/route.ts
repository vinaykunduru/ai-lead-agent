import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAssignmentHistory, getLeadTimeline, getStageHistory } from "@/modules/leads/timeline-service";
import { listNotes } from "@/modules/leads/notes-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const [activity, assignments, stageHistory, notes] = await Promise.all([
      getLeadTimeline(leadId),
      getAssignmentHistory(leadId),
      getStageHistory(leadId),
      listNotes(leadId),
    ]);
    return NextResponse.json({ activity, assignments, stageHistory, notes });
  } catch (error) {
    return apiError(error);
  }
}
