import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestReprocessDocument } from "@/modules/knowledge/documents-service";
import { knowledgeApiError } from "../../../_lib/handle-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await requestReprocessDocument(documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return knowledgeApiError(error);
  }
}
