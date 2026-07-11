import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteNote } from "@/modules/leads/notes-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string; noteId: string }> },
) {
  const { leadId, noteId } = await params;
  if (!uuidSchema.safeParse(leadId).success || !uuidSchema.safeParse(noteId).success) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  try {
    await deleteNote(leadId, noteId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
