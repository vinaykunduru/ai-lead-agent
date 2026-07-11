import { NextResponse, type NextRequest } from "next/server";
import { updateStagesSchema } from "@/modules/leads/validation";
import { listStages, updateStages } from "@/modules/leads/stages-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const stages = await listStages();
    return NextResponse.json({ stages });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateStagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const stages = await updateStages(parsed.data);
    return NextResponse.json({ stages });
  } catch (error) {
    return apiError(error);
  }
}
