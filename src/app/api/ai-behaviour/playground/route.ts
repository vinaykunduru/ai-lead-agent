import { NextResponse, type NextRequest } from "next/server";
import { playgroundTestSchema } from "@/modules/ai-behaviour/validation";
import { runPlaygroundTest } from "@/modules/ai-behaviour/playground-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = playgroundTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const result = await runPlaygroundTest(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
