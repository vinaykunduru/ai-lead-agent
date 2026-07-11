import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createTextDocumentSchema,
  createWebsiteDocumentSchema,
  uploadFileMetadataSchema,
} from "@/modules/knowledge/validation";
import {
  createTextDocument,
  createWebsiteDocument,
  listDocuments,
  uploadDocumentFile,
} from "@/modules/knowledge/documents-service";
import { knowledgeApiError } from "../_lib/handle-error";

export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId") ?? undefined;
  if (collectionId && !z.string().uuid().safeParse(collectionId).success) {
    return NextResponse.json({ error: "Invalid collectionId" }, { status: 400 });
  }

  try {
    const documents = await listDocuments({ collectionId });
    return NextResponse.json({ documents });
  } catch (error) {
    return knowledgeApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleFileUpload(request);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if ("url" in body) {
      const parsed = createWebsiteDocumentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      const document = await createWebsiteDocument(parsed.data);
      return NextResponse.json({ document }, { status: 201 });
    }

    const parsed = createTextDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const document = await createTextDocument(parsed.data);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return knowledgeApiError(error);
  }
}

async function handleFileUpload(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const collectionId = formData.get("collectionId");
  const title = formData.get("title");

  if (!(file instanceof File) || typeof collectionId !== "string" || typeof title !== "string") {
    return NextResponse.json({ error: "file, collectionId, and title are required" }, { status: 400 });
  }

  const parsedMeta = uploadFileMetadataSchema.safeParse({
    collectionId,
    title,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
  });
  if (!parsedMeta.success) {
    return NextResponse.json({ error: parsedMeta.error.issues[0]?.message ?? "Invalid file" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await uploadDocumentFile({
      collectionId: parsedMeta.data.collectionId,
      title: parsedMeta.data.title,
      fileName: parsedMeta.data.fileName,
      mimeType: parsedMeta.data.mimeType,
      buffer,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return knowledgeApiError(error);
  }
}
