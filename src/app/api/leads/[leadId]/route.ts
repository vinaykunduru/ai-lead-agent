import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateLeadSchema } from "@/modules/leads/validation";
import { deleteLead, getLead, updateLead } from "@/modules/leads/leads-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const lead = await getLead(leadId);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const lead = await updateLead(leadId, parsed.data);
    return NextResponse.json({ lead });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    await deleteLead(leadId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
