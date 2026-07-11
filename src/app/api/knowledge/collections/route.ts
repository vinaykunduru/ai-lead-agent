import { NextResponse, type NextRequest } from "next/server";
import { createCollectionSchema } from "@/modules/knowledge/validation";
import { createCollection, listCollections } from "@/modules/knowledge/collections-service";
import { knowledgeApiError } from "../_lib/handle-error";

export async function GET() {
  try {
    const collections = await listCollections();
    return NextResponse.json({ collections });
  } catch (error) {
    return knowledgeApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const collection = await createCollection(parsed.data);
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    return knowledgeApiError(error);
  }
}
