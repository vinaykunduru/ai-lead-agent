import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { removeTag } from "@/modules/leads/tags-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string; tagId: string }> },
) {
  const { leadId, tagId } = await params;
  if (!uuidSchema.safeParse(leadId).success || !uuidSchema.safeParse(tagId).success) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  try {
    await removeTag(leadId, tagId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
