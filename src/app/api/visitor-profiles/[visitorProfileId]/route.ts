import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateVisitorProfileSchema } from "@/modules/visitor-profiles/validation";
import { getVisitorProfile, updateVisitorProfile } from "@/modules/visitor-profiles/service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ visitorProfileId: string }> }) {
  const { visitorProfileId } = await params;
  if (!uuidSchema.safeParse(visitorProfileId).success) {
    return NextResponse.json({ error: "Visitor profile not found" }, { status: 404 });
  }

  try {
    const profile = await getVisitorProfile(visitorProfileId);
    if (!profile) return NextResponse.json({ error: "Visitor profile not found" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ visitorProfileId: string }> }) {
  const { visitorProfileId } = await params;
  if (!uuidSchema.safeParse(visitorProfileId).success) {
    return NextResponse.json({ error: "Visitor profile not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateVisitorProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const profile = await updateVisitorProfile(visitorProfileId, parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}
