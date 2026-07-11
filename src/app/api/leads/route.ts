import { NextResponse, type NextRequest } from "next/server";
import { createLeadSchema, leadSearchQuerySchema } from "@/modules/leads/validation";
import { createLead, listLeads } from "@/modules/leads/leads-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(request: NextRequest) {
  const parsed = leadSearchQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const leads = await listLeads(parsed.data);
    return NextResponse.json({ leads });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const lead = await createLead(parsed.data);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
