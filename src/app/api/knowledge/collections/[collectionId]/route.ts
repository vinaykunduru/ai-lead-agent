import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  archiveCollection,
  renameCollection,
  restoreCollection,
  softDeleteCollection,
} from "@/modules/knowledge/collections-service";
import { knowledgeApiError } from "../../_lib/handle-error";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  if (!z.string().uuid().safeParse(collectionId).success) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  if (!parsed.data.name && !parsed.data.status) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    let collection;
    if (parsed.data.name) {
      collection = await renameCollection({ collectionId, name: parsed.data.name });
    }
    if (parsed.data.status) {
      collection =
        parsed.data.status === "archived"
          ? await archiveCollection(collectionId)
          : await restoreCollection(collectionId);
    }
    return NextResponse.json({ collection });
  } catch (error) {
    return knowledgeApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  if (!z.string().uuid().safeParse(collectionId).success) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  try {
    await softDeleteCollection(collectionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return knowledgeApiError(error);
  }
}
