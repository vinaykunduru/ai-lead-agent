import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateLeadSummary } from "@/modules/leads/ai-summary";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const lead = await generateLeadSummary(leadId);
    return NextResponse.json({ lead });
  } catch (error) {
    return apiError(error);
  }
}
