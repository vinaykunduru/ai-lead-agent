import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { addTagSchema } from "@/modules/leads/validation";
import { addTag, listTags } from "@/modules/leads/tags-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const tags = await listTags(leadId);
    return NextResponse.json({ tags });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!uuidSchema.safeParse(leadId).success) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const tag = await addTag(leadId, parsed.data);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
