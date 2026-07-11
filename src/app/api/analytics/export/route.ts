import { NextResponse, type NextRequest } from "next/server";
import { exportQuerySchema } from "@/modules/analytics/validation";
import { exportAnalyticsReport } from "@/modules/analytics/export-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(request: NextRequest) {
  const parsed = exportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const { content, contentType, filename } = await exportAnalyticsReport(parsed.data);
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
