import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateDocumentSchema } from "@/modules/knowledge/validation";
import {
  archiveDocument,
  getDocument,
  getDocumentSearchStats,
  softDeleteDocument,
  updateDocument,
} from "@/modules/knowledge/documents-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const document = await getDocument(documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const searchStats = await getDocumentSearchStats(documentId);
    return NextResponse.json({ document, searchStats });
  } catch (error) {
    return apiError(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  collectionId: z.string().uuid().optional(),
  status: z.enum(["archived"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  if (!parsed.data.title && !parsed.data.collectionId && !parsed.data.status) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    let document;
    if (parsed.data.status === "archived") {
      document = await archiveDocument(documentId);
    }
    if (parsed.data.title || parsed.data.collectionId) {
      const updateInput = updateDocumentSchema.parse({
        documentId,
        title: parsed.data.title,
        collectionId: parsed.data.collectionId,
      });
      document = await updateDocument(updateInput);
    }
    return NextResponse.json({ document });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await softDeleteDocument(documentId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
