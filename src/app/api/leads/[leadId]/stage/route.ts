import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { changeStageSchema } from "@/modules/leads/validation";
import { changeLeadStage } from "@/modules/leads/leads-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changeStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const lead = await changeLeadStage(leadId, parsed.data);
    return NextResponse.json({ lead });
  } catch (error) {
    return apiError(error);
  }
}
