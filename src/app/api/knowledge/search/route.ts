import { NextResponse, type NextRequest } from "next/server";
import { semanticSearchSchema } from "@/modules/knowledge/validation";
import { semanticSearch } from "@/modules/knowledge/search-service";
import { knowledgeApiError } from "../_lib/handle-error";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = semanticSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const result = await semanticSearch(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return knowledgeApiError(error);
  }
}
