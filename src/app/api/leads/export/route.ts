import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { exportLeadsAsCsv } from "@/modules/leads/export/export-service";
import { apiError } from "@/app/api/_lib/handle-error";

const querySchema = z.object({ leadIds: z.string().optional() });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const leadIds = parsed.data.leadIds
    ? parsed.data.leadIds.split(",").filter((id) => z.string().uuid().safeParse(id).success)
    : undefined;

  try {
    const csv = await exportLeadsAsCsv({ leadIds });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
